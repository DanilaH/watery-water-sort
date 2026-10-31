// Offline exact A*: tube permutations are equivalent; h = runs - colors is admissible.
// A legal max-group pour removes at most one run. No color/empty-move pruning is assumed.
#include <array>
#include <vector>
#include <queue>
#include <unordered_map>
#include <algorithm>
#include <iostream>
#include <chrono>
using S=std::array<unsigned int,11>;
struct Hash{size_t operator()(S const&s)const{size_t h=1469598103934665603ULL;for(auto v:s)h=(h^v)*1099511628211ULL;return h;}};
struct Node{S b;int g,parent,from,to,amount,color;int goalSlot;};
struct Q{int f,g,id;bool operator<(Q const&z)const{return f!=z.f?f>z.f:g<z.g;}};
int len(int t){int n=0;while(t>1){t>>=3;n++;}return n;}
int runs(int t){int n=0,last=-1;while(t>1){int c=t&7;if(c!=last)n++;last=c;t>>=3;}return n;}
int main(){int level,extra,N,colors,first;while(std::cin>>level>>extra>>N>>colors>>first){std::vector<int>goalColors(first);for(auto &c:goalColors)std::cin>>c;S original{};for(int i=0;i<N;i++)std::cin>>original[i];S root=original;std::sort(root.begin()+first,root.begin()+N);auto heuristic=[&](S const&b){int r=0;for(int i=0;i<N;i++)r+=runs(b[i]);return r-colors;};
 auto started=std::chrono::steady_clock::now();std::vector<Node>ns{{root,0,-1,0,0,0,0}};std::unordered_map<S,int,Hash>best;best[root]=0;std::priority_queue<Q>pq;pq.push({heuristic(root),0,0});long expanded=0;int goal=-1;
 while(!pq.empty()){auto q=pq.top();pq.pop();auto n=ns[q.id];if(best[n.b]!=q.id)continue;bool win=true;for(int i=0;i<N;i++)if(i<first){if(len(n.b[i])!=8||runs(n.b[i])!=1)win=false;}else if(n.b[i]>1&&(len(n.b[i])!=4||runs(n.b[i])!=1||(std::find(goalColors.begin(),goalColors.end(),n.b[i]&7)!=goalColors.end())))win=false;if(win){goal=q.id;break;}expanded++;
 if(ns.size()>6000000){std::cerr<<"budget exhausted "<<level<<" "<<extra<<"\n";return 2;}
 for(int a=first;a<N;a++){int src=n.b[a];if(src==1||(a>first&&src==n.b[a-1]))continue;int c=src&7,group=0,tmp=src;while(tmp>1&&(tmp&7)==c){group++;tmp>>=3;}
 for(int z=0;z<N;z++){int dst=n.b[z];int capacity=z<first?8:4;if(a==z||len(dst)==capacity||(z<first&&c!=goalColors[z])||(dst>1&&(dst&7)!=c)||(z>first&&dst==n.b[z-1]&&z-1!=a))continue;int amount=std::min(group,capacity-len(dst));S b=n.b;b[a]>>=amount*3;for(int k=0;k<amount;k++)b[z]=(b[z]<<3)|c;std::sort(b.begin()+first,b.begin()+N);auto it=best.find(b);if(it!=best.end()&&ns[it->second].g<=n.g+1)continue;
 int id=ns.size();ns.push_back({b,n.g+1,q.id,src,dst,amount,c,z<first?z:-1});best[b]=id;pq.push({n.g+1+heuristic(b),n.g+1,id});}}
 }
 if(goal<0)return 3;std::vector<int>path;for(int i=goal;ns[i].parent>=0;i=ns[i].parent)path.push_back(i);std::reverse(path.begin(),path.end());S actual=original;
 std::cout<<"{\"level\":"<<level<<",\"extra\":"<<extra<<",\"optimal\":"<<ns[goal].g<<",\"lowerBound\":"<<heuristic(root)<<",\"expanded\":"<<expanded<<",\"states\":"<<ns.size()<<",\"path\":[";bool comma=false;
 for(int id:path){auto n=ns[id];int a=first,z=n.goalSlot>=0?n.goalSlot:first;while(actual[a]!=n.from)a++;if(n.goalSlot<0)while(actual[z]!=n.to||z==a)z++;if(comma)std::cout<<",";comma=true;std::cout<<"{\"from\":"<<a<<",\"to\":"<<z<<",\"amount\":"<<n.amount<<",\"color\":"<<n.color<<"}";actual[a]>>=n.amount*3;for(int k=0;k<n.amount;k++)actual[z]=(actual[z]<<3)|n.color;}
 std::cout<<"],\"ms\":"<<std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()-started).count()<<"}\n"<<std::flush;
 }}
