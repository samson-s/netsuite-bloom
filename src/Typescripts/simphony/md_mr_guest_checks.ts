/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getTokens, simphonyGetGuestChecks, GuestCheck, createCashSale } from '../md_simphony';
import * as runtime from 'N/runtime';
import * as log from 'N/log';
import * as format from 'N/format';

export const getInputData: EntryPoints.MapReduce.getInputData = async () => {
  const tokens = await getTokens();

  const dateParam = runtime.getCurrentScript().getParameter({ name: 'custscript_md_mr_guest_checks_sync_date' });
  let date = new Date();
  if (dateParam) {
    date = format.parse({ value: dateParam, type: format.Type.DATE }) as Date;
  }
  const locRef = runtime.getCurrentScript().getParameter({ name: 'custscript_md_mr_guest_checks_sync_loc' }) as string;

  const result = await simphonyGetGuestChecks(tokens.idToken, date, locRef);

  // Pass main fields(e.g. locRef) to each guest check
  for (let i = 0; i < result.guestChecks.length; i++) {
    result.guestChecks[i].locRef = result.locRef
  }

  return result.guestChecks;
}

export const map: EntryPoints.MapReduce.map = async (context) => {
  const guestCheck: GuestCheck = JSON.parse(context.value);
  try {
    await createCashSale(guestCheck);
  } catch (e) {
    log.error({ title: 'Error', details: e });
  }
}

export const summarize: EntryPoints.MapReduce.summarize = (summary) => {
  log.debug({ title: 'Summary', details: summary });
}
