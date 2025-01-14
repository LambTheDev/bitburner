import { CityName, CorpEmployeePosition, CorpIndustryName, CorpMaterialName, CorpStateName, CorpUnlockName, CorpUpgradeName, NS } from "@ns";

type DivisionName = 'agri' | 'chem';
const divisions: Record<DivisionName, CorpIndustryName> = {
  'agri': 'Agriculture',
  'chem': 'Chemical',
}

type Team = Partial<Record<CorpEmployeePosition, number>>;
// const positions: CorpEmployeePosition[] = [
//   'Business',
//   'Engineer',
//   'Intern',
//   'Management',
//   'Operations',
//   'Research & Development',
//   'Unassigned',
// ];

type Boosts = Partial<Record<CorpMaterialName, number>>;

/** 
 * Sleep for ms, based on setTimeout.
 * Bitburner does not let us use ns.sleep concurrently, for some reason... 
 * */
const sleepMs = (ms: number) => new Promise(
  (resolve) => setTimeout(resolve, ms),
);

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.tail();

  ns.corporation.createCorporation('lambda', false);

  let ghettoSupplyEnabled = false;
  await Promise.all([
    doMoraleAsync(),
    doGhettoSupplyAsync(),
    doPhase1Async().then(doPhase2Async),
  ]);

  ns.print('DONE');

  // Phases

  async function doMoraleAsync() {
    await doCitiesParallel(async (cityName) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        ns.corporation.getCorporation().divisions.forEach((divisionName) => {
          const { avgEnergy, avgMorale } =
            ns.corporation.getOffice(divisionName, cityName);
          if (avgEnergy < 99) {
            ns.corporation.buyTea(divisionName, cityName);
          }
          if (avgMorale < 99.5) {
            const costPerEmployee = avgMorale > 99 ? 1e5 : 1e6;
            ns.corporation.throwParty(divisionName, cityName, costPerEmployee);
          }
        });

        await waitState('START', true);
      }
    });
  }

  async function doGhettoSupplyAsync() {
    while (!ghettoSupplyEnabled) {
      await waitState('START', true);
    }
    await doCitiesParallel(async (cityName) => {
      while (!ns.corporation.hasUnlock('Smart Supply' as CorpUnlockName)) {
        const divisionName: DivisionName = 'agri';
        const industryName = divisions[divisionName];
        const { requiredMaterials, producedMaterials } =
          ns.corporation.getIndustryData(industryName);

        const inputFactors = Object.entries(requiredMaterials)
          .map(([materialName, factor]) => ({
            materialName: materialName as CorpMaterialName,
            factor,
          }));
        if (producedMaterials == null) throw new Error('no produced materials');
        const outputSizeSum = producedMaterials
          .map((x) => ns.corporation.getMaterialData(x).size)
          .reduce((xs, x) => xs + x, 0);
        const warehouse = ns.corporation.getWarehouse(divisionName, cityName);
        const sizeFree = warehouse.size - warehouse.sizeUsed - 1e-3;
        // TODO: actually calculate how much was left after production...
        if (sizeFree > 120) {
          await waitState('PURCHASE');
          inputFactors.forEach(({ materialName, factor }) => {
            ns.corporation.buyMaterial(
              divisionName,
              cityName,
              materialName,
              sizeFree / outputSizeSum * factor / 10,
            );
          });
          await waitState('PRODUCTION', true);
          inputFactors.forEach(({ materialName }) =>
            ns.corporation.buyMaterial(
              divisionName,
              cityName,
              materialName,
              0,
            )
          );
        }
        await waitState('SALE', true);
      }
    });
  }

  async function doPhase1Async() {
    mkDivision('agri');
    mkAdVert('agri', 2);
    mkUpgrade('Smart Storage', 6);

    await doCitiesParallel(async (cityName) => {
      mkWarehouse('agri', cityName, 6);
      mkOffice('agri', cityName, {
        'Research & Development': 4,
      });
    });

    await waitRpAsync('agri', 55);

    await doCitiesParallel(async (cityName) => {
      await waitHappy('agri', cityName);
      mkOffice('agri', cityName, {
        'Operations': 1,
        'Engineer': 1,
        'Business': 1,
        'Management': 1,
      });
      await mkBoostsAsync('agri', cityName, {
        'AI Cores': 1733,
        'Hardware': 1981,
        'Real Estate': 106686,
        'Robots': 0,
      });
      const divisionName: DivisionName = 'agri';
      ns.corporation.sellMaterial(
        divisionName,
        cityName,
        'Food' as CorpMaterialName,
        'MAX',
        'MP',
      );
      ns.corporation.sellMaterial(
        divisionName,
        cityName,
        'Plants' as CorpMaterialName,
        'MAX',
        'MP',
      );
      ghettoSupplyEnabled = true;
    });
    await mkRaiseFundsAsync(1, 490e9 + 20e9);
    mkUnlock('Export');
  }

  async function doPhase2Async() {
    mkDivision('chem');

    mkUnlock('Smart Supply');

    await doCitiesParallel(async (cityName) => {
      ns.corporation.setSmartSupply('agri' as DivisionName, cityName, true);
      mkOffice('agri', cityName, {
        'Research & Development': 8,
      });
      mkOffice('chem', cityName, {
        'Research & Development': 3,
      });

      mkWarehouse('agri', cityName, 16);
      mkWarehouse('chem', cityName, 2);

      mkAdVert('agri', 8);

      await Promise.all([
        waitRpAsync('agri', 700).then(() => {
          mkOffice('agri', cityName, {
            'Operations': 3,
            'Engineer': 1,
            'Business': 2,
            'Management': 2,
          });
        }),
        waitRpAsync('chem', 390).then(() => {
          mkOffice('chem', cityName, {
            'Operations': 1,
            'Engineer': 1,
            'Business': 1,
          });
        }),
      ]);
      mkExportRoute('Plants', cityName, 'chem', 'agri');
      mkExportRoute('Chemicals', cityName, 'agri', 'chem');
    });

    mkUpgrade('Smart Storage', 25);
    mkUpgrade('Smart Factories', 20);

    await doCitiesParallel(async (cityName) => {
      await mkBoostsAsync('agri', cityName, {
        'AI Cores': 8556,
        'Hardware': 9563,
        'Real Estate': 434200,
        'Robots': 1311,
      });
      await mkBoostsAsync('chem', cityName, {
        'AI Cores': 1717,
        'Hardware': 3194,
        'Real Estate': 54917,
        'Robots': 54,
      });
      ns.corporation.setSmartSupply('chem' as DivisionName, cityName, true);
    });
    mkRaiseFundsAsync(2, 14e12); // TODO: achievable?
    // mkUpgrade('Wilson Analytics', 1);
  }


  // Business operations

  /** START -> PURCHASE -> PRODUCTION -> EXPORT -> SALE */
  async function waitState(state: CorpStateName, waitProcessed = false) {
    while (ns.corporation.getCorporation().nextState != state) {
      await sleepMs(100);
    }
    if (waitProcessed) {
      while (ns.corporation.getCorporation().prevState != state) {
        await sleepMs(100);
      }
    }
  }

  async function waitHappy(divisionName: DivisionName, cityName: CityName) {
    let avgEnergy = 0;
    let avgMorale = 0;
    do {
      ({ avgEnergy, avgMorale } =
        ns.corporation.getOffice(divisionName, cityName));
      await waitState('START', true);
    } while (avgEnergy < 99 || avgMorale < 99);
  }

  function mkDivision(divisionName: DivisionName) {
    const industryType = divisions[divisionName];
    if (!divisionName) throw new Error('no industry name');

    const hasIndustry = ns.corporation.getCorporation()
      .divisions.includes(divisionName);
    if (!hasIndustry) {
      ns.corporation.expandIndustry(industryType, divisionName);
      ns.print(`Created division ${divisionName}`);
    }
    const division = ns.corporation.getDivision(divisionName);
    Object.values(ns.enums.CityName).forEach(cityName => {
      const hasCity = division.cities.includes(cityName);
      if (!hasCity) {
        ns.corporation.expandCity(divisionName, cityName);
      }
      const hasWarehouse = ns.corporation.hasWarehouse(divisionName, cityName);
      if (!hasWarehouse) {
        ns.corporation.purchaseWarehouse(divisionName, cityName);
      }
    });
  }

  function doCitiesParallel(f: (cityName: CityName) => Promise<void>): Promise<void[]> {
    return Promise.all(
      Object.values(ns.enums.CityName).map((cityName) => f(cityName)),
    );
  }

  function mkOffice(
    divisionName: DivisionName,
    cityName: CityName,
    team: Team,
  ) {
    const employeesNeeded = Object.values(team).reduce((xs, x) => xs + x, 0);
    const office = ns.corporation.getOffice(divisionName, cityName);
    const deltaOfficeSize = employeesNeeded - office.size;
    if (deltaOfficeSize > 0) {
      ns.corporation.upgradeOfficeSize(
        divisionName,
        cityName,
        deltaOfficeSize,
      );
    }
    for (let i = 0; i < employeesNeeded - office.numEmployees; i++) {
      ns.corporation.hireEmployee(divisionName, cityName);
    }
    ns.corporation.getConstants().employeePositions.forEach(position => {
      ns.corporation.setAutoJobAssignment(divisionName, cityName, position, 0);
    });
    ns.corporation.getConstants().employeePositions.forEach(position => {
      const n = team[position] ?? 0;
      ns.corporation.setAutoJobAssignment(divisionName, cityName, position, n);
    });
  }

  async function waitRpAsync(
    divisionName: DivisionName,
    rpNeeded: number,
  ): Promise<void> {
    let rp = 0;
    do {
      rp = ns.corporation.getDivision(divisionName).researchPoints;
      ns.print(
        `Waiting for ${divisionName} Research Points ` +
        `(${ns.formatNumber(rp)} / ${ns.formatNumber(rpNeeded)}) ...`
      );
      await waitState('START', true);
    } while (rp < rpNeeded);
  }

  function mkUpgrade(upgradeName: CorpUpgradeName, level: number) {
    const delta = level - ns.corporation.getUpgradeLevel(upgradeName);
    for (let i = 0; i < delta; i++) {
      ns.corporation.levelUpgrade(upgradeName);
    }
  }

  function mkWarehouse(
    divisionName: DivisionName,
    cityName: CityName,
    level: number,
  ) {
    const warehouse = ns.corporation.getWarehouse(divisionName, cityName);
    const delta = level - warehouse.level;
    if (delta > 0) {
      ns.corporation.upgradeWarehouse(divisionName, cityName, delta);
    }
  }

  function mkAdVert(divisionName: DivisionName, level: number) {
    const delta = level - ns.corporation.getHireAdVertCount(divisionName);
    for (let i = 0; i < delta; i++) {
      ns.corporation.hireAdVert(divisionName);
    }
  }

  async function mkBoostsAsync(
    divisionName: DivisionName,
    cityName: CityName,
    boosts: Boosts,
  ) {
    const boostsToBuy: Boosts = {};
    let anyBoostsToBuy = false;
    Object.entries(boosts).forEach(([materialName, amount]) => {
      const material = ns.corporation.getMaterial(
        divisionName,
        cityName,
        materialName,
      );
      const materialToBuy = amount - material.stored;
      if (materialToBuy > 0) {
        boostsToBuy[materialName as CorpMaterialName] = materialToBuy;
        anyBoostsToBuy = true;
      }
    });
    if (!anyBoostsToBuy) return;

    const warehouse = ns.corporation.getWarehouse(divisionName, cityName);
    const sizeUsedPrev = warehouse.sizeUsed;

    // start buying
    await waitState('PURCHASE');
    Object.entries(boostsToBuy).forEach(([materialName, amount]) => {
      const perTick = amount / 10;
      ns.corporation.buyMaterial(divisionName, cityName, materialName, perTick);
    });

    // wait tick
    await waitState('SALE', true);

    // stop buying
    Object.keys(boostsToBuy).forEach(materialName => {
      ns.corporation.buyMaterial(divisionName, cityName, materialName, 0);
    });
  }

  function mkUnlock(unlockName: CorpUnlockName) {
    if (ns.corporation.hasUnlock(unlockName)) return;
    ns.corporation.purchaseUnlock(unlockName);
  }

  async function mkRaiseFundsAsync(
    round: number,
    fundsNeeded: number,
  ): Promise<void> {
    let funds = 0;
    do {
      const offer = ns.corporation.getInvestmentOffer();
      if (offer.round > round) return; // already raised, uh oh?
      funds = offer.funds;
      ns.print(
        `Waiting for investment offer ` +
        `$${ns.formatNumber(funds)} / $${ns.formatNumber(fundsNeeded)} ...`
      );
      await waitState('START', true);
    } while (funds < fundsNeeded);

    // wait a bit extra for offer to stabilize
    await waitState('START', true);
    await waitState('START', true);

    ns.corporation.acceptInvestmentOffer();
  }

  function mkExportRoute(
    materialName: CorpMaterialName,
    cityName: CityName,
    divisionTo: DivisionName,
    divisionFrom: DivisionName,
  ) {
    ns.corporation.cancelExportMaterial(
      divisionFrom,
      cityName,
      divisionTo,
      cityName,
      materialName,
    );
    ns.corporation.exportMaterial(
      divisionFrom,
      cityName,
      divisionTo,
      cityName,
      materialName,
      '(IPROD+IINV/10)*(-1)',
    );
  }
}
