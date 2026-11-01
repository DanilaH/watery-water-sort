package com.danilah.waterywatersort;

import java.util.LinkedHashMap;
import java.util.Map;

/** Pure state: failed persistence retains the award in memory; failed ack never deletes it. */
public final class RewardLedger {
 public interface Store {Map<String,String> read();boolean write(Map<String,String> receipts);}
 private final Store store;
 private boolean dirty=false;
 private final LinkedHashMap<String,String> pending;
 public RewardLedger(Store store){this.store=store;pending=new LinkedHashMap<>(store.read());}
 public Map<String,String> pending(){return new LinkedHashMap<>(pending);}
 public boolean record(String token,String level){
  if(pending.containsKey(token)&&!level.equals(pending.get(token)))throw new IllegalArgumentException("Receipt collision");
  if(!pending.containsKey(token)){pending.put(token,level);dirty=true;}return flush();
 }
 public boolean flush(){if(!dirty)return true;try{if(!store.write(new LinkedHashMap<>(pending)))return false;dirty=false;return true;}catch(RuntimeException e){return false;}}
 public boolean ack(String token){
  LinkedHashMap<String,String> next=new LinkedHashMap<>(pending);next.remove(token);
  try{if(!store.write(next))return false;}catch(RuntimeException e){return false;}pending.clear();pending.putAll(next);dirty=false;return true;
 }
}
