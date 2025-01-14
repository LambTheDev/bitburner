import { NS } from "@ns";
import { ServerInfoMap } from "./lib/types";

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tail();

  const target = 'joesguns';
  const slavesJson = ns.read('slaves.json');
  if (!slavesJson) {
    ns.tprint('ERROR: Run pwn.js first.');
    return
  }
  const slaves = JSON.parse(slavesJson) as ServerInfoMap;

  const dateTimeFormatter = Intl.DateTimeFormat(
    'fi-FI',
    { hour: '2-digit', minute: '2-digit', second: '2-digit' },
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    ns.clearLog();

    const msWeaken = ns.getWeakenTime(target);
    Object.entries(slaves).forEach(([host, info]) => {
      const ramFree = info.maxRam - ns.getServerUsedRam(host);
      const threads = Math.floor(ramFree / 1.75);
      if (threads <= 0) return;
      ns.exec('weaken.js', host, threads, target, 0);
    });
    const readyAt = new Date(Date.now() + msWeaken);
    ns.print(`Weaken time: ${ns.tFormat(msWeaken)}.`)
    ns.print(`Ready at: ${dateTimeFormatter.format(readyAt)}`)
    await ns.sleep(msWeaken + 100);
  }
}
