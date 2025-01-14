import { NS } from "@ns";
import { ServerInfoMap } from "./lib/types";
import { SECURITY } from "./lib/constants";

type Phase = 'WEAKEN' | 'GW' | 'DONE';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');

  const hostsJson = ns.read('hosts.json');
  if (!hostsJson) {
    ns.tprint('ERROR: Run scan.js first.');
    return;
  }
  const hosts = JSON.parse(hostsJson) as ServerInfoMap;

  const slavesJson = ns.read('slaves.json');
  if (!slavesJson) {
    ns.tprint('ERROR: Run pwn.js first.');
    return
  }
  const slaves = JSON.parse(slavesJson) as ServerInfoMap;

  const targetName = ns.args[0] as string;
  if (targetName == null) {
    ns.tprint('Usage: ./noita.js <target>');
    return;
  }
  const target = hosts[targetName];

  ns.tail();
  let phase: Phase = 'WEAKEN';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    ns.clearLog();

    const security = ns.getServerSecurityLevel(targetName);
    const money = ns.getServerMoneyAvailable(targetName);
    const isMinSecurity = security === target.minSecurity;
    const isMaxMoney = money === target.maxMoney;
    
    if (isMinSecurity) {
      phase = 'GW';
      if (isMaxMoney) {
        phase = 'DONE';
      }
    }

    ns.print(`# ${phase} #`);

    const msWeaken = ns.getWeakenTime(targetName);
    const msGrow = ns.getGrowTime(targetName);
    const threads = Object.entries(slaves)
      .map(([host, info]) => {
        const ramFree = info.maxRam - ns.getServerUsedRam(host);
        return {
          host,
          threadsMax: Math.floor(ramFree / 1.75),
          threadsUsed: 0,
        };
      })
      .filter((x) => x.threadsMax > 0);

    if (phase == 'WEAKEN') {
      const weakensToMin = Math.ceil(
        (security - target.minSecurity) / SECURITY.WEAKEN_DECREASE
      );
      let weakensStarted = 0;
      threads.forEach((host) => {
        const threadsFree = host.threadsMax - host.threadsUsed;
        if (threadsFree <= 0) return;
        if (weakensStarted >= weakensToMin) return;
        const weakensToStart = Math.min(
          host.threadsMax - host.threadsUsed,
          weakensToMin - weakensStarted,
        );
        if (weakensToStart <= 0) return;

        host.threadsUsed += weakensToStart;
        ns.exec('weaken.js', host.host, weakensToStart, targetName, 0);
        weakensStarted += weakensToStart;
      });
      ns.print(`Started ${weakensStarted} / ${weakensToMin} weakens...`);
      if (weakensStarted >= weakensToMin) {
        phase = 'GW';
      }
    }

    if (phase == 'GW') {
      const growsPerWeaken = 
        Math.floor(SECURITY.WEAKEN_DECREASE / SECURITY.GROW_INCREASE);
      const growthNeeded = target.maxMoney / money;
      const growsToMax = Math.ceil(ns.growthAnalyze(targetName, growthNeeded));

      const growsPerBatch = Math.min(growsToMax, growsPerWeaken);
      const batchesToMax = growsPerBatch > 0 
        ? Math.ceil(growsToMax / growsPerBatch)
        : 0;
      const threadsPerBatch = growsPerBatch + 1;

      let batchesStarted = 0;
      let growsStarted = 0;
      threads.forEach((host) => {
        const threadsFree = host.threadsMax - host.threadsUsed;
        if (threadsFree <= 0) return;

        if (growsStarted >= growsToMax) return;

        const batchesFree = Math.floor(
          (host.threadsMax - host.threadsUsed) / threadsPerBatch,
        );
        const batchesLeft = Math.ceil(
          (growsToMax - growsStarted) / growsPerBatch,
        );
          
        const batchesToStart = Math.min(
          batchesFree,
          batchesLeft,
        );
        if (batchesToStart <= 0) return;

        const growsToStart = batchesToStart * growsPerBatch;
        ns.exec('grow.js', host.host, growsToStart, targetName, msWeaken - msGrow);
        ns.exec('weaken.js', host.host, batchesToStart, targetName, 0);

        batchesStarted += batchesToStart;
        growsStarted += growsToStart;
      });
      ns.print(`Started ${batchesStarted} / ${batchesToMax} GW batches...`);
    }

    if (phase === 'DONE') {
      return;
    }

    const dateTimeFormatter = Intl.DateTimeFormat(
      'fi-FI',
      { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    );
    const readyAt = new Date(Date.now() + msWeaken);
    ns.print(`Weaken time: ${ns.tFormat(msWeaken)}.`)
    ns.print(`Ready at: ${dateTimeFormatter.format(readyAt)}`)
    await ns.sleep(msWeaken + 100);
  }
}
