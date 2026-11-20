// performance/load-test-upload.k6.js
// Concurrent upload load test for the frontend upload endpoint.
//
// Targets the upload entry point used by the app (see README's video upload
// flow): POST /api/proxy/videos — a multipart upload through the frontend
// proxy.
//
// Usage:
//   k6 run performance/load-test-upload.k6.js \
//     -e BASE_URL=http://localhost:3000 -e VUS=10 -e DURATION=30s

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ENDPOINT = __ENV.ENDPOINT || '/api/proxy/videos';
const FILE_SIZE = parseInt(__ENV.FILE_SIZE || String(1024 * 1024), 10); // 1 MB default

export const options = {
  vus: parseInt(__ENV.VUS || '10', 10),
  duration: __ENV.DURATION || '30s',
};

export default function () {
  const payload = new Array(FILE_SIZE + 1).join('a');
  const res = http.post(
    `${BASE_URL}${ENDPOINT}`,
    { file: http.file(payload, 'load-test.mp4', 'video/mp4') },
    {
      headers: {
        ...(__ENV.AUTHORIZATION ? { Authorization: __ENV.AUTHORIZATION } : {}),
        ...(__ENV.COOKIES ? { Cookie: __ENV.COOKIES } : {}),
      },
    }
  );
  check(res, {
    'status is 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
  });
}
