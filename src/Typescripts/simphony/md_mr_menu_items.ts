/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { createOrUpdateNonInventoryItem, getTokens, simphonyGetMenuItems, MenuItem, getAllSymphonyLocRefs, createOrUpdateKitItem } from '../md_simphony';
import * as log from 'N/log';

export const getInputData: EntryPoints.MapReduce.getInputData = async () => {
  const tokens = await getTokens();

  const locations = await getAllSymphonyLocRefs();

  let menuItems: MenuItem[] = [];

  for (const locRef of Object.values(locations)) {
    try {
      const result = await simphonyGetMenuItems(tokens.idToken, locRef);
      result.menuItems.forEach((item) => {
        item.locRef = result.locRef;
      });
      menuItems = menuItems.concat(result.menuItems);
    } catch (e) {
      log.error({ title: 'Error', details: `Error fetching menu items for location ${locRef}, proceeding to next location.` });
    }
  }

  log.debug({ title: 'Menu Items', details: menuItems });

  return menuItems;
}

export const map: EntryPoints.MapReduce.map = async (context) => {
  const item: MenuItem = JSON.parse(context.value);

  // await createOrUpdateNonInventoryItem(item);
  await createOrUpdateKitItem(item);
}

export const summarize: EntryPoints.MapReduce.summarize = (summary) => {
  log.debug({ title: 'Summary', details: summary });
}
