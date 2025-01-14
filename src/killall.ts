import { NS } from "@ns";
import { ServerInfoMap } from "./lib/types";

export async function main(ns: NS) {
  const hostsJson = ns.read('hosts.json');
  if (!hostsJson) {
    ns.tprint('ERROR: Run scan.js first.');
    return;
  }
  const hosts = JSON.parse(hostsJson) as ServerInfoMap;
  Object.keys(hosts).forEach((x) => ns.killall(x, true));
}
