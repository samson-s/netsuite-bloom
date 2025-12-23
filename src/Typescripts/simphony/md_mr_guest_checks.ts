/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

import { EntryPoints } from 'N/types';
import { getTokens, simphonyGetGuestChecks, GuestCheck, createCashSale, getSymphonyLocRefs, getAllSymphonyLocRefs } from '../md_simphony';
import * as runtime from 'N/runtime';
import * as log from 'N/log';
import * as format from 'N/format';
import * as file from 'N/file';

export const getInputData: EntryPoints.MapReduce.getInputData = async () => {
  const tokens = await getTokens();

  const dateParam = runtime.getCurrentScript().getParameter({ name: 'custscript_md_mr_guest_checks_sync_date' });
  let date = new Date();
  date.setDate(date.getDate() - 1); // Set to yesterday
  if (dateParam) {
    date = format.parse({ value: dateParam, type: format.Type.DATE }) as Date;
  }
  const locationIds = JSON.parse((runtime.getCurrentScript().getParameter({ name: 'custscript_md_mr_guest_checks_sync_loc' }) as string));
  const locRefs = !locationIds || locationIds.length === 0 ? Object.values(await getAllSymphonyLocRefs()) : Object.values(await getSymphonyLocRefs(locationIds));
  log.audit({ title: 'Starting Guest Checks Sync', details: `Date: ${date}, Locations: ${locRefs}` });

  let guestChecks: GuestCheck[] = [];

  for (let i = 0; i < locRefs.length; i++) {
    const locRef = locRefs[i];
    try {
      const result = await simphonyGetGuestChecks(tokens.idToken, date, locRef);

      // Add locRef to each guest check because it is not included in the response
      for (let i = 0; i < result.guestChecks.length; i++) {
        result.guestChecks[i].locRef = result.locRef
      }

      guestChecks = guestChecks.concat(result.guestChecks);
    } catch (_) {
      log.error({ title: 'Error', details: `Error fetching guest checks for location ${locRef}, proceeding to next location.` });
    }
  }

  return guestChecks;
}

export const map: EntryPoints.MapReduce.map = async (context) => {
  const guestCheck: GuestCheck = JSON.parse(context.value);

  if (guestCheck.chkNum == 11362305) {
    // save the guestCheck to a file for debugging
    const fileObj = file.create({
      name: `guestCheck_${guestCheck.chkNum}.json`,
      fileType: file.Type.JSON,
      contents: JSON.stringify(guestCheck),
      folder: 9, // replace with your folder id
    });

    fileObj.save();
  }


  try {
    await createCashSale(guestCheck);
  } catch (e) {
    log.error({ title: 'Error', details: e });
  }
}

export const summarize: EntryPoints.MapReduce.summarize = (summary) => {
  log.debug({ title: 'Summary', details: summary });
}
