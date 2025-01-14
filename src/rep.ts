import { NS } from "@ns";
import { ServerInfoMap } from "./lib/types";

export async function main(ns: NS) {
  const slavesJson = ns.read('slaves.json');
  if (!slavesJson) {
    ns.tprint('ERROR: Run pwn.js first.');
    return
  }
  const slaves = JSON.parse(slavesJson) as ServerInfoMap;

  Object.entries(slaves).forEach(([host, info]) => {
    const ramFree = info.maxRam - ns.getServerUsedRam(host);
    const threads = Math.floor(ramFree / 4);
    if (threads <= 0) return;
    ns.exec('share.js', host, threads);
  });
  ns.tprint('Sharing all RAM.')
}
