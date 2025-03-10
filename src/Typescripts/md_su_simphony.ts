/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

import { EntryPoints } from 'N/types';
import * as log from 'N/log';
import * as serverWidget from 'N/ui/serverWidget';
import * as dialog from 'N/ui/dialog';
import * as task from 'N/task';
import * as format from 'N/format';

export let onRequest: EntryPoints.Suitelet.onRequest = async (context: EntryPoints.Suitelet.onRequestContext) => {
  try {
    await main(context);

  } catch (error) {
    log.error({ title: 'Error', details: error });
  }
};

async function main(context: EntryPoints.Suitelet.onRequestContext) {
  const form = serverWidget.createForm({
    title: 'Simphony NetSuite Integration',
  });

  const field = form.addField({
    id: 'target',
    type: serverWidget.FieldType.SELECT,
    label: 'Target',
  })
  field.addSelectOption({
    value: 'menuItems',
    text: 'Menu Items',
  })
  field.addSelectOption({
    value: 'guestchecks',
    text: 'Guest Checks',
  });

  form.addField({
    id: 'date',
    type: serverWidget.FieldType.DATE,
    label: 'Date',
  });

  const locationField = form.addField({
    id: 'location',
    type: serverWidget.FieldType.MULTISELECT,
    label: 'Location',
    source: 'location',
  })
  locationField.isMandatory = true;

  form.addSubmitButton({
    label: 'Submit',
  });

  if (context.request.method === 'POST') {
    const target = context.request.parameters.target;

    if (target === 'menuItems') {
      const mrTask = task.create({
        taskType: task.TaskType.MAP_REDUCE,
        scriptId: 'customscript_md_mr_sim_menu_items_sync',
      });
      mrTask.submit();
      dialog.confirm({
        title: 'Success',
        message: 'Menu Items Sync Task Submitted',
      });
    } else if (target === 'guestchecks') {
      const date = format.parse({
        value: context.request.parameters.date,
        type: format.Type.DATE,
      }) as Date;
      const locations = context.request.parameters.location.split('\u0005');
      const mrTask = task.create({
        taskType: task.TaskType.MAP_REDUCE,
        scriptId: 'customscript_md_mr_sim_guest_checks_sync',
      });
      mrTask.params = {
        custscript_md_mr_guest_checks_sync_date: date,
        custscript_md_mr_guest_checks_sync_loc: locations,
      };
      mrTask.submit();
      dialog.confirm({
        title: 'Success',
        message: 'Guest Checks Sync Task Submitted',
      });
    }
  }

  context.response.writePage(form);
}

