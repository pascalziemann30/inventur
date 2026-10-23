// Never present a result for an unconfirmed or different data environment as the requested check.
export function verifiedAccessCheckResult(result,expectedEnvironment) {
 if(!['dev','prod'].includes(expectedEnvironment)||!result||result.data_environment!==expectedEnvironment)throw new Error('ACCESS_CHECK_ENVIRONMENT_UNCONFIRMED');
 return result;
}
