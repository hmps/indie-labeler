import { LabelerServer } from '@skyware/labeler';

import { DB_PATH, DID, SIGNING_KEY } from './config.js';
import { DELETE, LABELS, LABEL_LIMIT } from './constants.js';
import logger from './logger.js';

export const labelerServer = new LabelerServer({
  did: DID,
  signingKey: SIGNING_KEY,
  dbPath: DB_PATH,
});

export const label = async (did: string, rkey: string) => {
  logger.info(`Received rkey: ${rkey} for ${did}`);

  if (rkey === 'self') {
    logger.info(`${did} liked the labeler. Returning.`);
    return;
  }
  try {
    const labels = await fetchCurrentLabels(did);
    logger.debug('Update labels:', labels);
    if (rkey.includes(DELETE)) {
      await deleteAllLabels(did, labels);
    } else {
      await addOrUpdateLabel(did, rkey, labels);
    }
  } catch (error) {
    logger.error(`Error in \`label\` function: ${error}`);
  }
};

async function fetchCurrentLabels(did: string) {
  const { rows } = await labelerServer.db.execute({
    sql: `SELECT * FROM labels WHERE uri = ?`,
    args: [did],
  });

  const labels = rows.reduce((set, unsafeLabel) => {
    const label = unsafeLabel as unknown as { val: string; neg: boolean };

    if (!label.neg) set.add(label.val);
    else set.delete(label.val);
    return set;
  }, new Set<string>());

  if (labels.size > 0) {
    logger.info(`Current labels: ${Array.from(labels).join(', ')}`);
  }

  return labels;
}

async function deleteAllLabels(did: string, labels: Set<string>) {
  const labelsToDelete: string[] = Array.from(labels);

  if (labelsToDelete.length === 0) {
    logger.info(`No labels to delete`);
  } else {
    logger.info(`Labels to delete: ${labelsToDelete.join(', ')}`);
    try {
      await labelerServer.createLabels({ uri: did }, { negate: labelsToDelete });
      logger.info('Successfully deleted all labels');
    } catch (error) {
      logger.error(`Error deleting all labels: ${error}`);
    }
  }
}

async function addOrUpdateLabel(did: string, rkey: string, labels: Set<string>) {
  const newLabel = LABELS.find((label) => label.rkey === rkey);
  if (!newLabel) {
    logger.warn(`New label not found: ${rkey}. Likely liked a post that's not one for labels.`);
    return;
  }
  logger.info(`New label: ${newLabel.identifier}`);

  if (labels.size >= LABEL_LIMIT) {
    try {
      await labelerServer.createLabels({ uri: did }, { negate: Array.from(labels) });
      logger.info(`Successfully negated existing labels: ${Array.from(labels).join(', ')}`);
    } catch (error) {
      logger.error(`Error negating existing labels: ${error}`);
    }
  }

  try {
    await labelerServer.createLabel({ uri: did, val: newLabel.identifier });
    logger.info(`Successfully labeled ${did} with ${newLabel.identifier}`);
  } catch (error) {
    logger.error(`Error adding new label: ${error}`);
  }
}
