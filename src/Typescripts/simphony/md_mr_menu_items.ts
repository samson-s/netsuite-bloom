/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { createOrUpdateNonInventoryItem, getTokens, simphonyGetMenuItems, MenuItem } from '../md_simphony';
import * as log from 'N/log';

export const getInputData: EntryPoints.MapReduce.getInputData = async () => {
  const tokens = await getTokens();

  const result = await simphonyGetMenuItems(tokens.idToken);
  return result.menuItems;
}

export const map: EntryPoints.MapReduce.map = async (context) => {
  const item: MenuItem = JSON.parse(context.value);

  await createOrUpdateNonInventoryItem(item);
}

export const summarize: EntryPoints.MapReduce.summarize = (summary) => {
  log.debug({ title: 'Summary', details: summary });
}
