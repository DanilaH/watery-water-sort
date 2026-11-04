import {solve} from './solver';
self.onmessage=({data:{board,rules}})=>self.postMessage(solve(board,35000,450,rules).status);
