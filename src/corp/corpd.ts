import { CityName, CorpEmployeePosition, CorpIndustryName, CorpMaterialName, CorpStateName, CorpUnlockName, CorpUpgradeName, NS } from "@ns";

type DivisionName = 'agri' | 'chem';
const divisions: Record<DivisionName, CorpIndustryName> = {
  'agri': 'Agriculture',
  'chem': 'Chemical',
}

type Team = Partial<Record<CorpEmployeePosition, number>>;
type BoostCorpMaterialName =
  | "Hardware"
  | "Robots"
  | "AI Cores"
  | "Real Estate";
type Boosts = Record<BoostCorpMaterialName, number>;

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
      const divisionName: DivisionName = 'agri';
      let warehouse = ns.corporation.getWarehouse(divisionName, cityName);
      const sizeReserved = warehouse.sizeUsed;

      while (!ns.corporation.hasUnlock('Smart Supply' as CorpUnlockName)) {
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
        warehouse = ns.corporation.getWarehouse(divisionName, cityName);
        const sizeFree = warehouse.size - warehouse.sizeUsed - 1e-3;
        if (sizeFree > 120) {
          await waitState('PURCHASE');
          inputFactors.forEach(({ materialName, factor }) => {
            const sizeWanted = sizeFree / outputSizeSum * factor;
            const sizeUsed = (warehouse.sizeUsed - sizeReserved) * factor;
            ns.corporation.buyMaterial(
              divisionName,
              cityName,
              materialName,
              (sizeWanted - sizeUsed) / 10,
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
      await mkBoostsAsync('agri', cityName);
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
    await mkRaiseFundsAsync(1, 545e9);
    mkUnlock('Export');
  }

  async function doPhase2Async() {
    mkDivision('chem');

    mkUnlock('Smart Supply');

    mkUpgrade('Smart Storage', 25);

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

      while (ns.corporation.getUpgradeLevel('Smart Factories') < 20) {
        mkUpgrade('Smart Factories', 20);
        await waitState('START', true);
      }

      await mkBoostsAsync('agri', cityName);
      await mkBoostsAsync('chem', cityName);
      ns.corporation.setSmartSupply('chem' as DivisionName, cityName, true);
    });
    mkRaiseFundsAsync(2, 11e12);
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

  function doCitiesParallel(
    f: (cityName: CityName) => Promise<void>,
  ): Promise<void[]> {
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

  async function mkUpgrade(upgradeName: CorpUpgradeName, level: number, wait = true) {
    if (wait) {
      while (ns.corporation.getUpgradeLevel(upgradeName) < level) {
        if (
          ns.corporation.getCorporation().funds >
          ns.corporation.getUpgradeLevelCost(upgradeName)
        ) {
          ns.corporation.levelUpgrade(upgradeName);
        } else {
          await waitState("START", true);
        }
      }
      return;
    }
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
      const funds = ns.corporation.getCorporation().funds;
      const cost = ns.corporation.getUpgradeWarehouseCost(
        divisionName,
        cityName,
        delta,
      );
      if (funds < cost) {
        throw new Error('Not enough funds to upgrade warehouse.');
      }
      ns.corporation.upgradeWarehouse(divisionName, cityName, delta);
    }
  }

  function mkAdVert(divisionName: DivisionName, level: number) {
    const delta = level - ns.corporation.getHireAdVertCount(divisionName);
    for (let i = 0; i < delta; i++) {
      const funds = ns.corporation.getCorporation().funds;
      const cost = ns.corporation.getHireAdVertCost(divisionName);
      if (funds < cost) {
        throw new Error('Not enough funds to hire AdVert.');
      }
      ns.corporation.hireAdVert(divisionName);
    }
  }


  function getBoostMaterialMultiplier(divisionName: DivisionName): number {
    let multiplier = 0.8;
    if (ns.corporation.getInvestmentOffer().round == 1) {
      multiplier = 0.86;
    }
    if (ns.corporation.getInvestmentOffer().round == 2) {
      multiplier = 0.76;
    }
    if (divisions[divisionName] === 'Chemical') {
      multiplier = 0.95;
    }
    return multiplier;
  }


  async function mkBoostsAsync(
    divisionName: DivisionName,
    cityName: CityName,
  ) {
    const multiplier = getBoostMaterialMultiplier(divisionName);
    const boosts = optimalMaterialStorage(
      divisionName,
      ns.corporation.getWarehouse(divisionName, cityName).size * multiplier)
    const boostsToBuy: Boosts = {
      "Real Estate": 0,
      Hardware: 0,
      Robots: 0,
      "AI Cores": 0
    };
    let anyBoostsToBuy = false;
    Object.entries(boosts).forEach(([materialName, amount]) => {
      const material = ns.corporation.getMaterial(
        divisionName,
        cityName,
        materialName,
      );
      const materialToBuy = amount - material.stored;
      if (materialToBuy > 0) {
        boostsToBuy[materialName as BoostCorpMaterialName] = materialToBuy;
        anyBoostsToBuy = true;
      }
    });
    if (!anyBoostsToBuy) return;

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

const matProdFactors: { [key: string]: { [key: string]: number } } = {
  "Energy": {
    "Hardware": 0.,
    "Real Estate": 0.65,
    "Robots": 0.05,
    "AI Cores": 0.3,
  },
  "Utilities": {
    "Hardware": 0.,
    "Real Estate": 0.5,
    "Robots": 0.4,
    "AI Cores": 0.4,
  },
  "Agriculture": {
    "Hardware": 0.2,
    "Real Estate": 0.72,
    "Robots": 0.3,
    "AI Cores": 0.3,
  },
  "Fishing": {
    "Hardware": 0.35,
    "Real Estate": 0.15,
    "Robots": 0.5,
    "AI Cores": 0.2,
  },
  "Mining": {
    "Hardware": 0.4,
    "Real Estate": 0.3,
    "Robots": 0.45,
    "AI Cores": 0.45,
  },
  "Food": {
    "Hardware": 0.15,
    "Real Estate": 0.05,
    "Robots": 0.3,
    "AI Cores": 0.25,
  },
  "Tobacco": {
    "Hardware": 0.15,
    "Real Estate": 0.15,
    "Robots": 0.2,
    "AI Cores": 0.15,
  },
  "Chemical": {
    "Hardware": 0.2,
    "Real Estate": 0.25,
    "Robots": 0.25,
    "AI Cores": 0.2,
  },
  "Pharmaceutical": {
    "Hardware": 0.15,
    "Real Estate": 0.05,
    "Robots": 0.25,
    "AI Cores": 0.2,
  },
  "Computer": {
    "Hardware": 0.,
    "Real Estate": 0.2,
    "Robots": 0.36,
    "AI Cores": 0.19,
  },
  "Robotics": {
    "Hardware": 0.,
    "Real Estate": 0.32,
    "Robots": 0.,
    "AI Cores": 0.36,
  },
  "Software": {
    "Hardware": 0.,
    "Real Estate": 0.15,
    "Robots": 0.05,
    "AI Cores": 0.,
  },
  "Healthcare": {
    "Hardware": 0.1,
    "Real Estate": 0.1,
    "Robots": 0.1,
    "AI Cores": 0.1,
  },
  "Real Estate": {
    "Hardware": 0.,
    "Real Estate": 0.,
    "Robots": 0.6,
    "AI Cores": 0.6,
  },
};
const matSizes: Boosts = {
  "Hardware": 0.06,
  "Real Estate": 0.005,
  "Robots": 0.5,
  "AI Cores": 0.1,
};

function optimalMaterialStorage(divisionName: DivisionName, size: number): Boosts {
  const industryType = divisions[divisionName];
  const beta = 0.002; // constant multiplier used in production factor calculation
  const epsilon = 1e-12;
  const alpha = matProdFactors[industryType];

  const storage: Boosts = {
    "Hardware": -1.,
    "Real Estate": -1.,
    "Robots": -1.,
    "AI Cores": -1.,
  };
  const removedMats: CorpMaterialName[] = []; // if the optimal solution requires negative material storage, resolve without that material
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let alphaSum = 0;
    let gSum = 0;
    Object.keys(matSizes).forEach(matStr => {
      const mat = matStr as BoostCorpMaterialName;
      if (!removedMats.includes(mat)) {
        gSum += matSizes[mat] ?? 0; // sum of material sizes
        alphaSum += alpha[mat]; // sum of material material "production factors"
      }
    });
    Object.keys(matSizes).forEach(matStr => {
      const mat = matStr as BoostCorpMaterialName;
      if (!removedMats.includes(mat)) {
        // solution of the constrained optimiztion problem via the method of Lagrange multipliers
        storage[mat] = 1. / beta *
          (alpha[mat] / alphaSum * (beta * size + gSum) / (matSizes[mat] ?? 0) - 1.);
      }
    });

    if (
      storage["Hardware"] >= -epsilon && storage["Real Estate"] >= -epsilon &&
      storage["Robots"] >= -epsilon && storage["AI Cores"] >= -epsilon
    ) {
      break;
    } else { // negative solutions are possible, remove corresponding material and resolve
      if (storage["Hardware"] < -epsilon) {
        storage["Hardware"] = 0., removedMats.push("Hardware");
        continue;
      }
      if (storage["Real Estate"] < -epsilon) {
        storage["Real Estate"] = 0., removedMats.push("Real Estate");
        continue;
      }
      if (storage["Robots"] < -epsilon) {
        storage["Robots"] = 0., removedMats.push("Robots");
        continue;
      }
      if (storage["AI Cores"] < -epsilon) {
        storage["AI Cores"] = 0., removedMats.push("AI Cores");
        continue;
      }
    }
  }
  return storage;
}

function getUpgradeCost(
  baseCost: number,
  multiplier: number,
  levelTo: number,
  levelFrom: number,
): number {
  return baseCost * (
    (Math.pow(multiplier, levelTo) - Math.pow(multiplier, levelFrom))
    /
    (multiplier - 1)
  );
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest;
  describe('getUpgradeCost', () => {
    it('SmartFactories 0 to 2', () => {
      const baseCost = 2e9;
      const multiplier = 1.06;
      const actual = getUpgradeCost(baseCost, multiplier, 2, 0);
      const expected = 2e9 + 2e9 * 1.06;
      expect(Math.abs(actual - expected)).lessThan(1e-3);
    });
    it('SmartFactories 1 to 2', () => {
      const baseCost = 2e9;
      const multiplier = 1.06;
      const actual = getUpgradeCost(baseCost, multiplier, 2, 1);
      const expected = 2e9 * 1.06;
      expect(Math.abs(actual - expected)).lessThan(1e-3);
    });
    it('SmartFactories 5 to 8', () => {
      const baseCost = 2e9;
      const multiplier = 1.06;
      const actual = getUpgradeCost(baseCost, multiplier, 8, 5);
      const expected = 8520749897.69472;
      expect(Math.abs(actual - expected)).lessThan(1e-3);
    });
  });
}
