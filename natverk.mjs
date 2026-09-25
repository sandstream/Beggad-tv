// Nodes inbyggda fetch struntar i HTTPS_PROXY. I molnmiljön går bara trafik
// genom proxyn ut — direkt ut svarar nätfiltret 403 "host_not_allowed", och
// bevakningen fick inte en enda sökning igenom trots att curl kom fram.
//
// Finns en proxy satt pekas fetch om genom den. Utan proxy (lokalt) görs
// ingenting.

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

if (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
