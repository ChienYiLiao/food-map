/**
 * Auth.gs — 使用者與頭像管理（延用 family-budget）
 */

function handleGetUsers(params) {
  const rows = readAllRows('USERS');
  return { users: rows };
}

function handleUpdateAvatar(body) {
  const userId      = body.userId      || body.user_id;
  const imageBase64 = body.imageBase64 || '';
  const mimeType    = body.mimeType    || 'image/jpeg';

  if (!userId)      throw new Error('Missing userId');
  if (!imageBase64) throw new Error('Missing imageBase64');

  const folderId = getProp('DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('DRIVE_FOLDER_ID not configured');

  const folder = DriveApp.getFolderById(folderId);
  const fileIter = folder.getFilesByName(`avatar_${userId}`);
  while (fileIter.hasNext()) fileIter.next().setTrashed(true);

  const ext  = mimeType.includes('png') ? 'png' : 'jpg';
  const blob = Utilities.newBlob(
    Utilities.base64Decode(imageBase64),
    mimeType,
    `avatar_${userId}.${ext}`
  );
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const avatarUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
  const now = nowIso();

  const ok = updateRow('USERS', 'user_id', userId, { avatar_url: avatarUrl, avatar_updated_at: now });
  if (!ok) {
    const names = { user_pigpig: '豬豬', user_gungun: '滾滾' };
    appendRow('USERS', {
      user_id: userId, display_name: names[userId] || userId,
      avatar_url: avatarUrl, avatar_updated_at: now, created_at: now
    });
  }
  return { avatarUrl };
}
