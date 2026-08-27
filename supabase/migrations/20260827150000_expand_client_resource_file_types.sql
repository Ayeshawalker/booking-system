update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'text/plain',
  'application/vnd.apple.pages',
  'application/x-iwork-pages-sffpages',
  'image/png',
  'image/jpeg',
  'image/webp'
]
where id = 'client-resources';

