import { NS } from "@ns";
import { ServerInfo, ServerInfoMap } from "./lib/types";

export async function main(ns: NS): Promise<void> {
  const hostsJson = ns.read('hosts.json');
  if (!hostsJson) {
    ns.tprint('ERROR: Run scan.js first.');
    return
  }

  const slaves: ServerInfoMap = {};
  let maxRam = 0;

  const portBreakers: Array<[string, (host: string) => void]> = [
    ['BruteSSH.exe', ns.brutessh],
    ['FTPCrack.exe', ns.ftpcrack],
    ['relaySMTP.exe', ns.relaysmtp],
    ['HTTPWorm.exe', ns.httpworm],
    ['SQLInject.exe', ns.sqlinject],
  ];
  const portBreakersAvailable = portBreakers
    .filter(([file, _]) => ns.fileExists(file))
    .map(([_, f]) => f)

  const hosts = JSON.parse(hostsJson) as ServerInfoMap;
  Object.entries(hosts).forEach(([hostName, info]) => {

    const portsRequired = ns.getServerNumPortsRequired(hostName);
    const canBreak = portsRequired <= portBreakersAvailable.length;
    if (ns.hasRootAccess(hostName) || canBreak) {
      portBreakersAvailable.forEach((f) => f(hostName))
      ns.nuke(hostName);

      if (info.maxRam === 0) return;
      slaves[hostName] = hosts[hostName];
      maxRam += hosts[hostName].maxRam;
    }
    ns.scp(['hack.js', 'weaken.js', 'grow.js', 'share.js'], hostName);
  });
  ns.write('slaves.json', JSON.stringify(slaves, undefined, 2), 'w');

  const serversByScoreDesc = Object.entries(hosts)
    .map(([name, serverInfo]) => ({ name, score: scoreServer(serverInfo) }))
    .filter((x) => ns.hasRootAccess(x.name))
    .sort((lhs, rhs) => rhs.score - lhs.score) // descending

  const serverToHack = serversByScoreDesc[0];

  ns.tprint(`INFO: Slaves: ${Object.keys(slaves).length}`);
  ns.tprint(`INFO: RAM: ${maxRam} GB`);
  ns.tprint(`INFO: Optimal hack target: ${serverToHack.name}`);

  // private functions
  function scoreServer(serverInfo: ServerInfo) {
    const hackingLevel = ns.getHackingLevel();

    if (hackingLevel < (serverInfo.hackingReq * 3)) {
      return 0;
    }

    return serverInfo.maxMoney;
  }
}

