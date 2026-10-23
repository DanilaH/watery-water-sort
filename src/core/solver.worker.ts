import { solve } from './solver';
self.onmessage = (event) => { const { board, revision, requestId } = event.data; self.postMessage({ result: solve(board), revision, requestId }); };
