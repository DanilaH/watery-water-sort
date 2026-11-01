package com.danilah.waterywatersort;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;

public class RewardLedgerTest {
 static class Disk implements RewardLedger.Store {
  Map<String,String> rows=new LinkedHashMap<>();boolean writable=true;
  public Map<String,String> read(){return new LinkedHashMap<>(rows);}
  public boolean write(Map<String,String> next){if(!writable)return false;rows=new LinkedHashMap<>(next);return true;}
 }
 @Test public void earnedReceiptSurvivesProcessRecreationUntilAck(){Disk disk=new Disk();RewardLedger first=new RewardLedger(disk);assertTrue(first.record("a","water-003@1"));RewardLedger restored=new RewardLedger(disk);assertEquals("water-003@1",restored.pending().get("a"));assertTrue(restored.ack("a"));assertTrue(new RewardLedger(disk).pending().isEmpty());}
 @Test public void failedWriteKeepsVolatileAwardAndLaterFlushRecovers(){Disk disk=new Disk();disk.writable=false;RewardLedger ledger=new RewardLedger(disk);assertFalse(ledger.record("a","water-003@1"));assertEquals(1,ledger.pending().size());assertTrue(disk.rows.isEmpty());disk.writable=true;assertTrue(ledger.flush());assertEquals(ledger.pending(),new RewardLedger(disk).pending());}
 @Test public void failedAcknowledgementNeverDeletesAward(){Disk disk=new Disk();RewardLedger ledger=new RewardLedger(disk);ledger.record("a","water-003@1");disk.writable=false;assertFalse(ledger.ack("a"));assertEquals(1,ledger.pending().size());assertEquals(1,new RewardLedger(disk).pending().size());disk.writable=true;assertTrue(ledger.ack("a"));assertTrue(ledger.pending().isEmpty());}
 @Test public void duplicateCallbackIsIdempotentAndForeignAwardsStaySeparate(){Disk disk=new Disk();RewardLedger ledger=new RewardLedger(disk);ledger.record("a","water-003@1");ledger.record("a","water-003@1");ledger.record("b","water-004@1");assertEquals(2,ledger.pending().size());ledger.ack("a");assertEquals(Collections.singletonMap("b","water-004@1"),ledger.pending());}
 @Test public void callersCannotMutateJournalSnapshot(){Disk disk=new Disk();RewardLedger ledger=new RewardLedger(disk);ledger.record("a","water-003@1");ledger.pending().clear();assertEquals(1,ledger.pending().size());}
 @Test public void storageExceptionsKeepTheAwardRecoverable(){Disk disk=new Disk(){public boolean write(Map<String,String> next){throw new IllegalStateException("Disk unavailable");}};RewardLedger ledger=new RewardLedger(disk);assertFalse(ledger.record("a","water-003@1"));assertFalse(ledger.ack("a"));assertEquals(1,ledger.pending().size());}
 @Test(expected=IllegalArgumentException.class) public void conflictingTokenNeverReassignsLevel(){RewardLedger ledger=new RewardLedger(new Disk());ledger.record("a","water-003@1");ledger.record("a","water-004@1");}
}
