/** Serialize settings writes, coalescing pending gestures without losing fields. */
export class LatestWriteQueue<T extends object> {
  private pending: T | null = null;
  private running: Promise<void> | null = null;
  constructor(private current: T, private write: (value:T)=>Promise<void>) {}
  synchronize(value:T) { if (!this.running) this.current=value; }
  push(patch:Partial<T>):Promise<void> {
    this.current={...this.current,...patch};
    this.pending=this.current;
    if(!this.running) this.running=this.drain();
    return this.running;
  }
  private async drain() {
    // Yield before calling a writer that could throw synchronously, so push()
    // assigns running before cleanup. Clear it inside this task, without a gap
    // between the last pending check and releasing ownership of the queue.
    await Promise.resolve();
    try {
      while(this.pending) {
        const value=this.pending;this.pending=null;
        await this.write(value);
      }
    } finally {this.running=null;}
  }
}
