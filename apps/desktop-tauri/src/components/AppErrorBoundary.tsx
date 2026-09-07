import React from "react";

interface Props {
  children: React.ReactNode;
  onReload?: () => void;
}

interface State {
  error: Error | null;
}

/** Last-resort UI: a broken route must never leave an unexplained black window. */
export default class AppErrorBoundary extends React.Component<Props,State>{
  state:State={error:null};

  static getDerivedStateFromError(error:Error):State{return {error};}

  componentDidCatch(error:Error,info:React.ErrorInfo):void{
    console.error("[quotaarc] fatal render failure",error,info.componentStack);
  }

  render():React.ReactNode{
    if(!this.state.error)return this.props.children;
    return <main className="app-fatal" role="alert">
      <section className="app-fatal__card">
        <span className="app-fatal__eyebrow">QUOTAARC RECOVERY</span>
        <h1>Quotalis could not open this view</h1>
        <p>Your settings are safe. Reload the interface, then report the diagnostic below if it returns.</p>
        <code>{this.state.error.message||this.state.error.name}</code>
        <button type="button" onClick={()=>{if(this.props.onReload)this.props.onReload();else window.location.reload();}}>Reload Quotalis</button>
      </section>
    </main>;
  }
}
