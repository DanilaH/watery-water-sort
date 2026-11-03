import {generateShuffle} from './shuffle';
self.onmessage=({data})=>{try{self.postMessage({revision:data.revision,event:generateShuffle(data.level,data.attempt,data.rules,data.seed)});}catch{self.postMessage({revision:data.revision});}};
