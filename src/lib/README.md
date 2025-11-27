# React Worker Library

Une bibliothèque TypeScript pour gérer facilement et efficacement des Web Workers dans une application React.

## 📦 Installation

```typescript
import { useWorker, useWorkerPool } from './lib';
```

## 🚀 Fonctionnalités

- ✅ **Hook React simple** - `useWorker` pour gérer un worker unique
- ✅ **Pool de workers** - `useWorkerPool` pour gérer plusieurs workers en parallèle
- ✅ **TypeScript complet** - Types stricts pour toutes les API
- ✅ **Callbacks typés** - Gestion d'événements avec `onReady`, `onError`, `onProgress`, etc.
- ✅ **Timeouts configurables** - Éviter les opérations qui bloquent
- ✅ **Gestion d'erreurs** - Retry automatique avec `restart()`
- ✅ **Protocole extensible** - Support des messages personnalisés
- ✅ **Log level configurable** - Debug, info, warn, error
- ✅ **Pas de fuite mémoire** - Nettoyage automatique des listeners

## 📖 Usage

### Worker unique avec `useWorker`

```typescript
import { useWorker } from './lib';

const MyComponent = () => {
  const worker = useWorker({
    script: new URL('./my.worker.ts', import.meta.url),
    autostart: true,
    timeout: 5000,
    logLevel: 'debug',
    callbacks: {
      onReady: () => console.log('Worker prêt'),
      onError: (reason) => console.error('Erreur:', reason),
      onProgress: (percent, message) => console.log(`${percent}%`, message),
    },
  });

  const handleClick = () => {
    worker.postMessage({ type: 'ACTION', payload: 'data' });
  };

  return (
    <div>
      <p>Status: {worker.status}</p>
      {worker.error && <p>Error: {worker.error.message}</p>}
      <button onClick={handleClick}>Send Message</button>
      <button onClick={worker.restart}>Restart</button>
    </div>
  );
};
```

### Pool de workers avec `useWorkerPool`

```typescript
import { useWorkerPool } from './lib';

const MyComponent = () => {
  const pool = useWorkerPool({
    script: new URL('./my.worker.ts', import.meta.url),
    poolSize: 4,
    autostart: true,
    timeout: 10000,
  });

  const handleHeavyTask = async () => {
    try {
      const result = await pool.postMessage({
        type: 'ACTION',
        payload: 'heavy computation'
      });
      console.log('Result:', result);
    } catch (error) {
      console.error('Task failed:', error);
    }
  };

  return (
    <div>
      <p>Status: {pool.status}</p>
      <p>Workers disponibles: {pool.availableWorkers}</p>
      <p>Tâches en attente: {pool.queueLength}</p>
      <button onClick={handleHeavyTask}>Execute Task</button>
    </div>
  );
};
```

### Créer un Worker

```typescript
// my.worker.ts
import {
  onMainMessage,
  sendReady,
  sendActed,
  sendProgress,
  sendLog,
  sendHealth,
  sendTerminated,
} from './lib';

const WORKER_ID = 'my-worker';

sendReady(WORKER_ID);
sendLog(WORKER_ID, 'info', 'Worker initialized');

onMainMessage({
  onAction: (payload) => {
    sendLog(WORKER_ID, 'debug', 'Processing action', payload);

    // Simulation de progression
    sendProgress(WORKER_ID, 50, 'En cours...');

    const result = processData(payload);

    sendProgress(WORKER_ID, 100, 'Terminé');
    sendActed(WORKER_ID, result);
  },

  onHealthCheck: () => {
    const memory = performance.memory?.usedJSHeapSize;
    sendHealth(WORKER_ID, 'healthy', memory);
  },

  onTerminate: () => {
    sendLog(WORKER_ID, 'info', 'Terminating worker');
    sendTerminated(WORKER_ID);
    self.close();
  },
});

function processData(data: unknown) {
  // Votre logique métier
  return data;
}
```

## 🔧 API

### `useWorker(props)`

**Props:**

- `script: string | URL` - URL du worker script
- `options?: WorkerOptions` - Options du Web Worker
- `autostart?: boolean` - Démarrer automatiquement (default: `false`)
- `timeout?: number` - Timeout en ms pour les opérations
- `logLevel?: 'debug' | 'info' | 'warn' | 'error'` - Niveau de log (default: `'info'`)
- `callbacks?: WorkerCallbacks` - Callbacks pour les événements

**Returns:**

- `start: () => void` - Démarrer le worker
- `postMessage: (message: Inbound) => void` - Envoyer un message
- `onMessage: (handler) => () => void` - Écouter les messages
- `terminate: () => void` - Terminer le worker
- `restart: () => void` - Redémarrer le worker
- `status: WorkerStatus` - Status actuel
- `error: Error | null` - Dernière erreur

### `useWorkerPool(props)`

**Props:**

- `script: string | URL` - URL du worker script
- `poolSize?: number` - Nombre de workers (default: `4`)
- `options?: WorkerOptions` - Options du Web Worker
- `autostart?: boolean` - Démarrer automatiquement (default: `false`)
- `timeout?: number` - Timeout en ms pour les opérations (default: `30000`)
- `logLevel?: 'debug' | 'info' | 'warn' | 'error'` - Niveau de log
- `callbacks?: WorkerCallbacks` - Callbacks pour les événements

**Returns:**

- `start: () => void` - Démarrer le pool
- `postMessage: (message: Inbound) => Promise<Outbound>` - Envoyer un message (retourne une Promise)
- `terminate: () => void` - Terminer tous les workers
- `restart: () => void` - Redémarrer le pool
- `status: WorkerStatus` - Status global
- `availableWorkers: number` - Nombre de workers disponibles
- `queueLength: number` - Nombre de tâches en attente

## 📝 Types de messages

### Standard Inbound (Main → Worker)

- `PING` - Vérifier que le worker répond
- `ECHO { payload: string }` - Écho simple
- `ACTION { payload: unknown }` - Action métier
- `HEALTH_CHECK` - Vérifier la santé du worker
- `TERMINATE` - Arrêt gracieux

### Standard Outbound (Worker → Main)

- `READY` - Worker initialisé
- `PONG` - Réponse au PING
- `ECHOED { payload: string }` - Réponse à ECHO
- `ACTED { result: unknown }` - Résultat d'une action
- `HEALTH { status, memory? }` - État de santé
- `PROGRESS { percent, message? }` - Progression
- `LOG { level, message, data? }` - Message de log
- `ERROR { reason }` - Erreur fatale
- `WARNING { reason }` - Avertissement
- `TERMINATED` - Worker terminé

## 🎯 Messages personnalisés

```typescript
// Définir vos types personnalisés
type MyCustomMessage =
  | { type: 'CALCULATE'; payload: number }
  | { type: 'RESULT'; value: number };

// Dans le worker
onMainMessage<number, MyCustomMessage>({
  onCustom: (msg) => {
    if (msg.type === 'CALCULATE') {
      const result = msg.payload * 2;
      self.postMessage({ type: 'RESULT', value: result });
    }
  },
});

// Dans React
const worker = useWorker<MyCustomMessage>({
  script: new URL('./custom.worker.ts', import.meta.url),
});

worker.postMessage({ type: 'CALCULATE', payload: 42 });
```

## 💡 Bonnes pratiques

1. **Utilisez `useWorkerPool`** pour des tâches parallèles intensives
2. **Configurez un timeout** pour éviter les blocages
3. **Utilisez `callbacks`** pour une gestion d'événements propre
4. **Activez `logLevel: 'debug'`** en développement
5. **Utilisez `restart()`** plutôt que `terminate()` + `start()`
6. **Nettoyez les workers** avec `terminate()` dans le cleanup

## 🐛 Debugging

Activez les logs détaillés :

```typescript
const worker = useWorker({
  script: new URL('./my.worker.ts', import.meta.url),
  logLevel: 'debug', // Affiche tous les messages
});
```

Les logs apparaissent dans la console du navigateur avec le préfixe `[Worker Log]`.

## 📄 License

MIT
