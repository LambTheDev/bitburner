import { NS } from "@ns";

export async function main(ns: NS) {
  ns.disableLog("ALL");

  const vps = [...new Array(25)]
    .map((_, i) => {
      const host = `lambda-${String(i + 1).padStart(2, '0')}`;
      return {
        host,
        ram: ns.serverExists(host) ? ns.getServerMaxRam(host) : 0,
      };
    })
    .sort((lhs, rhs) => {
      // sort by RAM ASC
      const deltaRam = lhs.ram - rhs.ram;
      if (deltaRam !== 0) return deltaRam;

      // then by host ASC
      return lhs.host.localeCompare(rhs.host);
    });

  const ramMaxPurchasable = ns.getPurchasedServerMaxRam();
  let minRam = 4;

  for (const { host, ram } of vps) {
    const money = ns.getPlayer().money;
    const startRam = Math.max(ram, minRam);

    for (let r = ramMaxPurchasable; r > startRam; r = r / 2) {
      const cost = ns.getPurchasedServerCost(r);
      if (money > cost) {
        const costText = "$" + ns.formatNumber(cost);
        ns.tprint(
          `Upgraded server ${host} ` + 
          `from ${ns.formatRam(ram)} to ${ns.formatRam(r)} ` +
          `with ${costText}`,
        );

        if (ns.serverExists(host)) {
          ns.killall(host);
          ns.deleteServer(host);
        }
        ns.purchaseServer(host, r);

        if (r == ramMaxPurchasable) {
          minRam = ramMaxPurchasable - 1;
          break; // keep buying
        } else {
          return;
        }
      }
    }
  }
}
