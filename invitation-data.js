(function (global) {
  var config = global.INVITATION_CONFIG || {};
  var client = null;

  function isConfigured() {
    return Boolean(
      config.supabaseUrl &&
      config.supabaseAnonKey &&
      config.adminEmail &&
      !config.supabaseUrl.includes('YOUR-PROJECT') &&
      !config.supabaseAnonKey.includes('YOUR-SUPABASE') &&
      !config.adminEmail.includes('YOUR-ADMIN')
    );
  }

  function getClient() {
    if (!isConfigured()) {
      throw new Error('Add your Supabase project settings to supabase-config.js.');
    }
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error('The invitation service could not be loaded. Refresh and try again.');
    }
    if (!client) {
      client = global.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    return client;
  }

  global.invitationData = {
    adminEmail: config.adminEmail,
    isConfigured: isConfigured,
    getClient: getClient
  };
})(window);
