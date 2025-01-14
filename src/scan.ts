import { NS } from "@ns";
import { ServerInfo, ServerInfoMap } from "./lib/types";

export async function main(ns: NS): Promise<void> {
  const map: {[key: string]: ServerInfo} = {};
  scanRec(map, 'home', []);
  const json = JSON.stringify(map, undefined, 2);
  ns.write('hosts.json', json, 'w');
  const serverCount = Object.keys(map).length;
  ns.tprint(`Scanned. Found ${serverCount} servers.`);

  function createServerInfo(name: string, path: string[]): ServerInfo {
    const connectString = [name, ...path]
      .reverse()
      .filter(x => x != 'home')
      .map(x => `connect ${x}`)
      .join(';');
    const server = ns.getServer(name);

    return {
      connectString: 'home;' + connectString,
      cores: server.cpuCores,
      hackingReq: server.requiredHackingSkill!,
      maxMoney: server.moneyMax!,
      maxRam: server.maxRam,
      minSecurity: server.minDifficulty!,
      path,
    }
  }

  function scanRec(map: ServerInfoMap, name: string, path: string[]) {
    const serverInfo = createServerInfo(name, path);
    map[name] = serverInfo;
    const hosts = ns.scan(name).filter(x => !path.includes(x));
    for (const host of hosts) {
      scanRec(map, host, [name, ...path]);
    }
  }
}

