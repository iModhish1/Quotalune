//! Shared exclusion for onboarding, refresh and credential changes. Reservations
//! are made before spawning work and released by Drop, including cancellation.
use quotalis_core::core::ProviderId;
use std::{
    collections::HashMap,
    sync::{Arc, LazyLock, Mutex},
};
use tokio::sync::{Semaphore, watch};

#[derive(Default)]
pub(crate) struct OperationRegistry(Mutex<HashMap<ProviderId, Arc<watch::Sender<bool>>>>);

pub(crate) static OPERATIONS: LazyLock<OperationRegistry> =
    LazyLock::new(OperationRegistry::default);
pub(crate) static IO_PERMITS: LazyLock<Semaphore> = LazyLock::new(|| Semaphore::new(3));

pub(crate) struct Operation<'a> {
    registry: &'a OperationRegistry,
    provider: ProviderId,
    sender: Arc<watch::Sender<bool>>,
}

impl OperationRegistry {
    pub(crate) fn begin(&self, provider: ProviderId) -> Result<Operation<'_>, String> {
        let mut active = self
            .0
            .lock()
            .map_err(|_| "Connection operation unavailable")?;
        if active.contains_key(&provider) {
            return Err("A provider operation is already running".into());
        }
        let (sender, _) = watch::channel(false);
        let sender = Arc::new(sender);
        active.insert(provider, sender.clone());
        Ok(Operation {
            registry: self,
            provider,
            sender,
        })
    }
    pub(crate) fn cancel(&self, provider: ProviderId) -> bool {
        let Ok(active) = self.0.lock() else {
            return false;
        };
        if let Some(sender) = active.get(&provider) {
            sender.send_replace(true);
            true
        } else {
            false
        }
    }
}

impl Operation<'_> {
    /// Linearize final publication with cancel. Callers acquire any settings
    /// transaction first; the registry lock must never wait for that lock.
    pub(crate) fn commit_if_active<T>(
        &self,
        commit: impl FnOnce() -> Result<T, String>,
    ) -> Result<T, String> {
        let mut active = self
            .registry
            .0
            .lock()
            .map_err(|_| "Connection operation unavailable")?;
        if *self.sender.borrow()
            || !active
                .get(&self.provider)
                .is_some_and(|sender| Arc::ptr_eq(sender, &self.sender))
        {
            return Err("Connection operation canceled".into());
        }
        let result = commit();
        active.remove(&self.provider);
        result
    }
    pub(crate) fn cancellation(&self) -> watch::Receiver<bool> {
        self.sender.subscribe()
    }
}
impl Drop for Operation<'_> {
    fn drop(&mut self) {
        if let Ok(mut active) = self.registry.0.lock()
            && active
                .get(&self.provider)
                .is_some_and(|sender| Arc::ptr_eq(sender, &self.sender))
        {
            active.remove(&self.provider);
        }
    }
}

pub(crate) async fn cancelled(receiver: &mut watch::Receiver<bool>) {
    loop {
        if *receiver.borrow_and_update() {
            return;
        }
        if receiver.changed().await.is_err() {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn repeated_cancel_retry_and_disconnect_cycles_release_every_reservation() {
        let registry = OperationRegistry::default();
        for _ in 0..100 {
            let operation = registry.begin(ProviderId::Codex).unwrap();
            assert!(registry.begin(ProviderId::Codex).is_err());
            assert!(registry.begin(ProviderId::Claude).is_ok());
            let mut cancellation = operation.cancellation();
            assert!(registry.cancel(ProviderId::Codex));
            cancelled(&mut cancellation).await;
            // A canceled task still owns its slot until cleanup finishes.
            assert!(registry.begin(ProviderId::Codex).is_err());
            drop(operation);
            assert!(registry.0.lock().unwrap().is_empty());
        }
    }
    #[test]
    fn cancellation_while_waiting_for_settings_prevents_commit() {
        let registry = OperationRegistry::default();
        let settings = Mutex::new(());
        let held = settings.lock().unwrap();
        let saved = std::sync::atomic::AtomicBool::new(false);
        std::thread::scope(|scope| {
            let operation = registry.begin(ProviderId::Codex).unwrap();
            let saved = &saved;
            let settings = &settings;
            let (ready, waiting) = std::sync::mpsc::channel();
            let worker = scope.spawn(move || {
                ready.send(()).unwrap();
                let _transaction = settings.lock().unwrap();
                operation.commit_if_active(|| {
                    saved.store(true, std::sync::atomic::Ordering::SeqCst);
                    Ok(())
                })
            });
            waiting.recv().unwrap();
            assert!(registry.cancel(ProviderId::Codex));
            drop(held);
            assert!(worker.join().unwrap().is_err());
        });
        assert!(!saved.load(std::sync::atomic::Ordering::SeqCst));
        assert!(registry.0.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn all_provider_detection_is_bounded_to_three_operations() {
        let permits = Arc::new(Semaphore::new(3));
        let active = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let peak = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut tasks = Vec::new();
        for _ in ProviderId::all() {
            let (permits, active, peak) = (permits.clone(), active.clone(), peak.clone());
            tasks.push(tokio::spawn(async move {
                let _permit = permits.acquire().await.unwrap();
                let count = active.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                peak.fetch_max(count, std::sync::atomic::Ordering::SeqCst);
                tokio::task::yield_now().await;
                active.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
            }));
        }
        for task in tasks {
            task.await.unwrap();
        }
        assert!(peak.load(std::sync::atomic::Ordering::SeqCst) <= 3);
        assert_eq!(active.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    #[test]
    fn canceled_credential_transaction_never_reads_or_writes_the_store() {
        let registry = OperationRegistry::default();
        for provider in [ProviderId::Copilot, ProviderId::Claude] {
            let operation = registry.begin(provider).unwrap();
            // Simulates cancellation while key preparation/browser extraction
            // is in flight, before entering the protected-store transaction.
            assert!(registry.cancel(provider));
            let result = operation.commit_if_active(|| -> Result<(), String> {
                panic!("A canceled operation must not even open the credential store")
            });
            assert_eq!(result.unwrap_err(), "Connection operation canceled");
            drop(operation);
            assert!(registry.begin(provider).is_ok());
        }
    }

    #[test]
    fn credential_commit_winning_the_race_cannot_report_successful_cancellation() {
        let registry = OperationRegistry::default();
        let writes = std::sync::atomic::AtomicUsize::new(0);
        std::thread::scope(|scope| {
            let operation = registry.begin(ProviderId::Copilot).unwrap();
            let (entered, committing) = std::sync::mpsc::channel();
            let (release, resume) = std::sync::mpsc::channel();
            let registry = &registry;
            let writes = &writes;
            let writer = scope.spawn(move || {
                operation.commit_if_active(|| {
                    entered.send(()).unwrap();
                    resume.recv().unwrap();
                    writes.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    Ok(())
                })
            });
            committing.recv().unwrap();
            let cancel = scope.spawn(|| registry.cancel(ProviderId::Copilot));
            release.send(()).unwrap();
            writer.join().unwrap().unwrap();
            // Cancellation cannot claim to have stopped an already committed
            // write. There is no check-then-write window outside the mutex.
            assert!(!cancel.join().unwrap());
        });
        assert_eq!(writes.load(std::sync::atomic::Ordering::SeqCst), 1);
        assert!(registry.0.lock().unwrap().is_empty());
    }

    #[test]
    fn failed_credential_commit_releases_slot_and_allows_retry() {
        let registry = OperationRegistry::default();
        let operation = registry.begin(ProviderId::Copilot).unwrap();
        assert!(
            operation
                .commit_if_active(|| Err::<(), _>("Protected storage unavailable".to_string()))
                .is_err()
        );
        let retry = registry.begin(ProviderId::Copilot).unwrap();
        drop(operation);
        assert!(registry.begin(ProviderId::Copilot).is_err());
        assert!(retry.commit_if_active(|| Ok(())).is_ok());
    }
}
