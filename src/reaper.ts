import { NS } from "@ns";
import { ServerInfoMap } from "./lib/types";
import { SECURITY } from "./lib/constants";

interface Slave {
  cores: number,
  host: string,
  threads: number,
}

interface HgwExecCommand {
  host: string,
  type: 'HACK' | 'WEAKEN' | 'GROW',
  threads: number,
}
interface BreakCommand {
  type: 'BREAK',
}
type ExecCommand = HgwExecCommand | BreakCommand;

/** prios hacks on same slave, but splits if neccessary */
function tryAllocBatch(
  slaves: Slave[],
  threadsUsed: { [host: string]: number },
  hacks: number,
  weakensHack: number,
  grows: number,
  weakensGrow: number,
): ExecCommand[] {
  const slavesByFree = 
    slaves
      .map(x => ({ 
        cores: x.cores,
        host: x.host,
        threadsFree: x.threads - (threadsUsed[x.host] ?? 0),
      }));
      //.sort((lhs, rhs) => {
      //  // sort by descending threadsFree
      //  const deltaThreads = rhs.threadsFree - lhs.threadsFree;
      //  if (deltaThreads !== 0) return deltaThreads;

      //  return lhs.cores - rhs.cores; // then by ascending cores
      //});
  
  const commands: ExecCommand[] = [];

  // hacks
  slavesByFree.forEach((slave) => {
    const hacksToRun = Math.min(hacks, slave.threadsFree);
    if (hacksToRun == 0) return;
    hacks -= hacksToRun;
    slave.threadsFree -= hacksToRun;
    commands.push({ host: slave.host, threads: hacksToRun, type: 'HACK' });
  });

  // overhead (WGW)
  for (let i = slavesByFree.length - 1; i >= 0; i--) {
    const slave = slavesByFree[i];
    const weakensHackToRun = Math.min(weakensHack, slave.threadsFree);
    if (weakensHackToRun == 0) continue;

    weakensHack -= weakensHackToRun;
    slave.threadsFree -= weakensHackToRun;
    commands.push({ host: slave.host, threads: weakensHackToRun, type: 'WEAKEN' });
  }
  for (let i = slavesByFree.length - 1; i >= 0; i--) {
    const slave = slavesByFree[i];
    const growsToRun = Math.min(grows, slave.threadsFree);
    if (growsToRun == 0) continue;

    grows -= growsToRun;
    slave.threadsFree -= growsToRun;
    commands.push({ host: slave.host, threads: growsToRun, type: 'GROW' });
  }
  for (let i = slavesByFree.length - 1; i >= 0; i--) {
    const slave = slavesByFree[i];
    const weakensGrowToRun = Math.min(weakensGrow, slave.threadsFree);
    if (weakensGrowToRun == 0) continue;

    weakensGrow -= weakensGrowToRun;
    slave.threadsFree -= weakensGrowToRun;
    commands.push({ host: slave.host, threads: weakensGrowToRun, type: 'WEAKEN' });
  }
  commands.push({ type: 'BREAK' });

  const isAllAlloc = 
    hacks == 0
    && weakensHack == 0
    && grows == 0
    && weakensGrow == 0;
  
  return isAllAlloc
    ? commands
    : [];
}

function allocAllBatches(
  getGrowsForHacks: (hacks: number) => number,
  batchesMax: number,
  hacksPerBatch: number,
  slaves: Slave[],
): ExecCommand[] {
  const weakensForHacks = Math.ceil(
    (hacksPerBatch * SECURITY.HACK_INCREASE) / SECURITY.WEAKEN_DECREASE,
  );
  const growsForHacks = getGrowsForHacks(hacksPerBatch)
  const weakensForGrows = Math.ceil(
    (growsForHacks * SECURITY.GROW_INCREASE) / SECURITY.WEAKEN_DECREASE,
  );

  const commands: ExecCommand[] = [];
  let commandsToAppend: ExecCommand[] = [];
  const threadsUsed: { [host: string]: number } = {};
  for (let i = 0; i < batchesMax; i++) {
    commandsToAppend = tryAllocBatch(
      slaves,
      threadsUsed,
      hacksPerBatch,
      weakensForHacks,
      growsForHacks,
      weakensForGrows,
    );

    // out of memory
    if (commandsToAppend.length == 0) break;

    commandsToAppend.forEach(x => {
      if (x.type === 'BREAK') return;

      threadsUsed[x.host] = (threadsUsed[x.host] ?? 0) + x.threads;
    });
    commands.push(...commandsToAppend);
  }

  return commands;
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');

  const slavesJson = ns.read('slaves.json');
  if (!slavesJson) {
    ns.tprint('ERROR: Run pwn.js first.');
    return
  }
  const slaves = JSON.parse(slavesJson) as ServerInfoMap;

  if (ns.args.length < 2) {
    ns.tprint('Usage: ./reaper.js <target> <hacks>');
    return;
  }
  const targetName = ns.args[0] as string;
  const hacksPerBatch = ns.args[1] as number;

  ns.tail();
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    ns.clearLog();

    const [msHack, msWeaken, msGrow] = [
      ns.getHackTime(targetName),
      ns.getWeakenTime(targetName),
      ns.getGrowTime(targetName),
    ];
    const threads = Object.keys(slaves)
      .map((host) => {
        const ramFree = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        return {
          cores: 1,
          host,
          threads: Math.floor(ramFree / 1.75),
        } as Slave;
      })
      .filter((x) => x.threads > 0);
    
    const batchesPerMs = 1;
    const batchesMax = (msWeaken - 1000) * batchesPerMs;
    const commands = allocAllBatches(
      (hacks) => getGrowsForHacks(targetName, hacks),
      batchesMax,
      hacksPerBatch,
      threads,
    );
    
    let batchesRan = 0;
    for (const x of commands) {
      switch (x.type) {
        case 'HACK': {
          ns.exec('hack.js', x.host, x.threads, targetName, msWeaken - msHack);
          break;
        }
        case 'GROW': {
          ns.exec('grow.js', x.host, x.threads, targetName, msWeaken - msGrow);
          break;
        }
        case 'WEAKEN': {
          ns.exec('weaken.js', x.host, x.threads, targetName, 0);
          break;
        }
        case 'BREAK': {
          if (batchesRan >= batchesPerMs) {
            batchesRan = 0;
            await ns.sleep(1);
            break;
          }
        }
      }
    }

    const dateTimeFormatter = Intl.DateTimeFormat(
      'fi-FI',
      { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    );
    const readyAt = new Date(Date.now() + msWeaken);
    ns.print(`Weaken time: ${ns.tFormat(msWeaken)}.`)
    ns.print(`Ready at: ${dateTimeFormatter.format(readyAt)}`)
    await ns.sleep(msWeaken + 1000);
  }

  function getGrowsForHacks(target: string, hacks: number): number {
    const hackAmount = ns.hackAnalyze(targetName);
    const growthNeeded = 1 / (1 - (hacks * hackAmount));
    return Math.ceil(ns.growthAnalyze(target, growthNeeded * 1.1));
  }
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest;
  describe('tryAllocBatch', () => {
    it('smoke', () => {
      const slaves: Slave[] = [
        { cores: 1, host: 'S1', threads: 21 },
        { cores: 1, host: 'S2', threads: 66 },
      ];
      const commands = tryAllocBatch(slaves, {}, 21, 1, 60, 5);
      const hackThreads = commands
        .filter(x => x.type == 'HACK')
        .reduce((xs, x) => xs + (x as HgwExecCommand).threads, 0)
      expect(hackThreads).toBe(21);
    });
  })
}
