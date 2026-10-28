import { solve } from './solver';
self.onmessage = (event) => { const { board, goal, revision, requestId } = event.data; self.postMessage({ result: solve(board,200000,750,goal), revision, requestId }); };
