/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';
import { createOrUpdateDiscountItem, Discount, getAllSymphonyLocRefs, getTokens, simphonyGetDiscountDimensions } from '../md_simphony';

export const getInputData: EntryPoints.MapReduce.getInputData = async () => {
  const tokens = await getTokens();
  const locations = await getAllSymphonyLocRefs();

  let discountDimemsions: Discount[] = [];

  for (const locRef of Object.values(locations)) {
    try {
      const result = await simphonyGetDiscountDimensions(tokens.idToken, locRef);
      result.discounts.forEach((dim) => {
        dim.locRef = result.locRef;
      });
      discountDimemsions = discountDimemsions.concat(result.discounts);
    } catch (e) {
      log.error({ title: 'Origin Error', details: e });
      log.error({ title: 'Error', details: `Error fetching discount dimensions for location ${locRef}, proceeding to next location.` });
    }
  }

  return discountDimemsions;
}

export const map: EntryPoints.MapReduce.map = async (context) => {
  const dimension: Discount = JSON.parse(context.value);

  await createOrUpdateDiscountItem(dimension);
}

export const summarize: EntryPoints.MapReduce.summarize = (summary) => {
  log.debug({ title: 'Summary', details: summary });
}
