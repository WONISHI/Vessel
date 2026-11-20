import { parentPort, workerData } from 'node:worker_threads'
import { runWorkspaceIndex } from '../../../packages/@vessel/workspace/src/graph/run-index'
import wasmPath from '../../../packages/@vessel/workspace/wasm/workspace-index.wasm?asset'
void runWorkspaceIndex(wasmPath, workerData.root, workerData.cache, (graph) => parentPort?.postMessage({ type: 'progress', graph })).then(
  (graph) => parentPort?.postMessage({ graph }),
  (error) => parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) })
)
