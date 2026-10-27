// Bridge to the BareTube Android app (android/). Only present when the PWA
// runs inside the app's WebView; every helper is a no-op in a normal browser.

interface AndroidBridge {
  postMessage(message: string): void;
  onmessage: ((event: { data: string }) => void) | null;
}

declare global {
  interface Window {
    BareTubeAndroid?: AndroidBridge;
  }
}

export const isAndroidApp = typeof window !== 'undefined' && !!window.BareTubeAndroid;

function send(message: object): void {
  window.BareTubeAndroid?.postMessage(JSON.stringify(message));
}

export function saveFile(name: string, mime: string, content: string): void {
  send({ type: 'saveFile', name, mime, content });
}

export function signIn(): void {
  send({ type: 'signIn' });
}

export function signOut(): void {
  send({ type: 'signOut' });
}

export function getSignedIn(): Promise<boolean> {
  const bridge = window.BareTubeAndroid;
  if (!bridge) return Promise.resolve(false);
  return new Promise((resolve) => {
    bridge.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'account') resolve(!!msg.signedIn);
      } catch {
        resolve(false);
      }
    };
    send({ type: 'getAccount' });
  });
}
