import { NS } from "@ns";
import { ServerInfoMap } from "./lib/types";

export async function main(ns: NS): Promise<void> {
  const hosts = JSON.parse(ns.read("hosts.json")) as ServerInfoMap;

  const factionServers = 
    [
      "CSEC",             // CyberSec
      "avmnite-02h",      // NiteSec
      "I.I.I.I",          // The Black Hand
      "run4theh111z",     // BitRunners
      "The-Cave",         // Daedalus
      "w0r1d_d43m0n",     // Endgame

      // requires company rep 200K
      // "fulcrumassets"     // Fulcrum Secret Technologies
    ]
    .filter(x => hosts[x] != null)
    .map(x => ({
      connectString: hosts[x].connectString,
      name: x,
      server: ns.getServer(x),
    }))
    .filter(x => !x.server.backdoorInstalled);
  
  factionServers.sort((lhs, rhs) => 
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    lhs.server.requiredHackingSkill! - rhs.server.requiredHackingSkill!
  )
  
  factionServers.forEach(({ connectString, name, server }) => {
    ns.tprint(`${name} (${server.requiredHackingSkill}):`);
    ns.tprint(`  ${connectString};backdoor`);
  });
}