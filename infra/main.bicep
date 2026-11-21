// Infrastruttura Azure per l'app "Impegni" (un solo utente, regione UE).
// Distribuzione: vedi docs/deploy.md
targetScope = 'resourceGroup'

@description('Prefisso breve per i nomi delle risorse (3-10 lettere minuscole e numeri, senza trattini).')
@minLength(3)
@maxLength(10)
param baseName string

@description('Regione principale (UE).')
param location string = 'westeurope'

@description('Regione dell\'account Azure OpenAI. Deve essere UE con deployment "Standard" regionale: swedencentral o northeurope (in westeurope il listino pubblica solo il tier globale, dove i dati possono essere elaborati fuori UE).')
@allowed(['swedencentral', 'northeurope'])
param openAiLocation string = 'swedencentral'

@description('Nome del modello OpenAI usato per estrarre gli impegni.')
param openAiModelName string = 'gpt-4o-mini'

@description('Versione del modello OpenAI.')
param openAiModelVersion string = '2024-07-18'

@description('SKU del deployment. "Standard" = regionale: i dati restano nella regione UE scelta. NON usare GlobalStandard (elaborazione ovunque).')
@allowed(['Standard', 'DataZoneStandard'])
param openAiDeploymentSku string = 'Standard'

@description('Capacità del deployment, in migliaia di token al minuto.')
param openAiCapacity int = 10

@description('Tenant Microsoft Entra ID dell\'azienda.')
param tenantId string = tenant().tenantId

@description('Client ID dell\'app registrata in Entra ID (vedi docs/registrazione-entra-id.md).')
param apiClientId string

var suffix = uniqueString(resourceGroup().id, baseName)
var tags = { app: 'impegni' }

// ---------- Monitoraggio (log senza contenuti: lo garantisce il codice) ----------
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${baseName}-logs-${suffix}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${baseName}-ai-${suffix}'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
    DisableIpMasking: false
  }
}

// ---------- Identità gestita usata dalle Functions ----------
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-id-${suffix}'
  location: location
  tags: tags
}

// ---------- Key Vault ----------
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${baseName}-kv-${suffix}', 24)
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

// ---------- Cosmos DB (serverless) ----------
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: '${baseName}-cosmos-${suffix}'
  location: location
  kind: 'GlobalDocumentDB'
  tags: tags
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0, isZoneRedundant: false }]
    capabilities: [{ name: 'EnableServerless' }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    disableLocalAuth: true // solo accesso con identità, niente chiavi
    minimalTlsVersion: 'Tls12'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'impegni'
  properties: { resource: { id: 'impegni' } }
}

resource notes 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'notes'
  properties: {
    resource: {
      id: 'notes'
      partitionKey: { paths: ['/userId'], kind: 'Hash' }
    }
  }
}

resource settings 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDb
  name: 'settings'
  properties: {
    resource: {
      id: 'settings'
      partitionKey: { paths: ['/userId'], kind: 'Hash' }
    }
  }
}

// Ruolo dati integrato "Cosmos DB Built-in Data Contributor"
resource cosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmos
  name: guid(cosmos.id, identity.id, 'data-contributor')
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: identity.properties.principalId
    scope: cosmos.id
  }
}

// ---------- Azure AI Speech ----------
resource speech 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${baseName}-speech-${suffix}'
  location: location
  kind: 'SpeechServices'
  sku: { name: 'S0' }
  tags: tags
  properties: {
    customSubDomainName: '${baseName}-speech-${suffix}' // necessario per l'accesso con identità
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

// ---------- Azure OpenAI ----------
resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${baseName}-oai-${suffix}'
  location: openAiLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  tags: tags
  properties: {
    customSubDomainName: '${baseName}-oai-${suffix}'
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource extractionModel 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'estrazione'
  sku: { name: openAiDeploymentSku, capacity: openAiCapacity }
  properties: {
    model: { format: 'OpenAI', name: openAiModelName, version: openAiModelVersion }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

// ---------- Storage per il deploy delle Functions ----------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('${baseName}st${suffix}', 24)
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  tags: tags
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource deployContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'app-package'
}

// ---------- Static Web Apps (frontend PWA) ----------
resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${baseName}-web-${suffix}'
  location: location
  tags: tags
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

// ---------- Azure Functions (Flex Consumption) ----------
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${baseName}-plan-${suffix}'
  location: location
  kind: 'functionapp'
  tags: tags
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}

resource api 'Microsoft.Web/sites@2023-12-01' = {
  name: '${baseName}-api-${suffix}'
  location: location
  kind: 'functionapp,linux'
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}app-package'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: identity.id
          }
        }
      }
      scaleAndConcurrency: { maximumInstanceCount: 10, instanceMemoryMB: 2048 }
      runtime: { name: 'node', version: '20' }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      cors: {
        allowedOrigins: ['https://${web.properties.defaultHostname}', 'http://localhost:5173']
      }
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storage.name }
        { name: 'AzureWebJobsStorage__credential', value: 'managedidentity' }
        { name: 'AzureWebJobsStorage__clientId', value: identity.properties.clientId }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId } // identità gestita da usare
        { name: 'ENTRA_TENANT_ID', value: tenantId }
        { name: 'ENTRA_API_CLIENT_ID', value: apiClientId }
        { name: 'KEY_VAULT_URI', value: vault.properties.vaultUri }
        { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
        { name: 'COSMOS_DATABASE', value: cosmosDb.name }
        { name: 'SPEECH_ENDPOINT', value: speech.properties.endpoint }
        { name: 'OPENAI_ENDPOINT', value: openai.properties.endpoint }
        { name: 'OPENAI_DEPLOYMENT', value: extractionModel.name }
      ]
    }
  }
}

// ---------- Assegnazione ruoli all'identità gestita ----------
var roles = {
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  cognitiveServicesUser: 'a97b65f3-24c7-4388-baec-2e87135dc908'
  cognitiveServicesOpenAiUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
}

resource roleVault 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, identity.id, roles.keyVaultSecretsUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleStorage 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, identity.id, roles.storageBlobDataOwner)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataOwner)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleSpeech 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: speech
  name: guid(speech.id, identity.id, roles.cognitiveServicesUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource roleOpenAi 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openai
  name: guid(openai.id, identity.id, roles.cognitiveServicesOpenAiUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesOpenAiUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------- Output ----------
output webUrl string = 'https://${web.properties.defaultHostname}'
output apiUrl string = 'https://${api.properties.defaultHostName}'
output apiName string = api.name
output webName string = web.name
output identityClientId string = identity.properties.clientId
output identityPrincipalId string = identity.properties.principalId
