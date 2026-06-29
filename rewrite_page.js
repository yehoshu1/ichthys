const fs = require('fs');
const path = require('path');

const pagePath = path.join('/home/josh/Projects/ixoye/src/dashboard/app/dashboard/[guildId]/welcome/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Add imports for components
const importsToAdd = `
import { MessageConfigTab } from './components/MessageConfigTab';
import { RolesTab } from './components/RolesTab';
`;

content = content.replace("import { Separator } from '@/components/ui/separator';", "import { Separator } from '@/components/ui/separator';" + importsToAdd);

// 2. Add guildConfig state to page (for autoRoleId)
const stateToAdd = `
    const [guildConfig, setGuildConfig] = useState<any>({});
`;
content = content.replace("const [config, setConfig] = useState<WelcomeConfig>(defaultConfig as WelcomeConfig);", stateToAdd + "\n    const [config, setConfig] = useState<WelcomeConfig>(defaultConfig as WelcomeConfig);");

// 3. Update fetchData to also fetch guild config
const fetchReplacement = `
                const [configRes, channelsRes, guildRes] = await Promise.all([
                    fetch(\`/api/guilds/\${guildId}/welcome/config\`),
                    fetch(\`/api/guilds/\${guildId}/channels\`),
                    fetch(\`/api/guilds/\${guildId}\`)
                ]);

                if (configRes.ok) {
                    const data = await configRes.json();
                    const mergedConfig = { ...defaultConfig, ...data.config };
                    setConfig(mergedConfig as WelcomeConfig);
                    setOriginalConfig(mergedConfig as WelcomeConfig);
                }

                if (channelsRes.ok) {
                    const data = await channelsRes.json();
                    setChannels(data.channels || []);
                }
                
                if (guildRes.ok) {
                    const data = await guildRes.json();
                    setGuildConfig(data.guild || {});
                }
`;

content = content.replace(/const \[configRes, channelsRes\] = await Promise\.all\(\[[^\]]+\]\);/s, "const [configRes, channelsRes, guildRes] = await Promise.all([\n                    fetch(`/api/guilds/${guildId}/welcome/config`),\n                    fetch(`/api/guilds/${guildId}/channels`),\n                    fetch(`/api/guilds/${guildId}`)\n                ]);");

content = content.replace(/if \(configRes\.ok\) \{[\s\S]*?if \(channelsRes\.ok\) \{[\s\S]*?\}/s, `if (configRes.ok) {
                    const data = await configRes.json();
                    const mergedConfig = { ...defaultConfig, ...data.config };
                    setConfig(mergedConfig as WelcomeConfig);
                    setOriginalConfig(mergedConfig as WelcomeConfig);
                }

                if (channelsRes.ok) {
                    const data = await channelsRes.json();
                    setChannels(data.channels || []);
                }
                
                if (guildRes.ok) {
                    const data = await guildRes.json();
                    setGuildConfig(data.guild || {});
                }`);

// 4. Update saveConfig to also save guild config
const saveGuildReplacement = `
            const response2 = await fetch(\`/api/guilds/\${guildId}\`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoRoleId: guildConfig.autoRoleId })
            });
`;
content = content.replace("const data = await response.json();", saveGuildReplacement + "\n            const data = await response.json();");

// 5. Update insertVariable
const insertVariableOld = `    const insertVariable = useCallback((variable: string) => {
        const template = config.messageTemplate || '';
        updateConfig('messageTemplate', template + variable);
    }, [config.messageTemplate, updateConfig]);`;

const insertVariableNew = `    const insertVariable = useCallback((variable: string, key = 'messageTemplate') => {
        const template = config[key as keyof WelcomeConfig] || '';
        updateConfig(key, template + variable);
    }, [config, updateConfig]);`;

content = content.replace(insertVariableOld, insertVariableNew);

// 6. Replace everything from {/* Main Enable Toggle */} to end of container
const startIndex = content.indexOf('{/* Main Enable Toggle */}');
const endIndexStr = `                            </CardContent>
                        </Card>
                    )}
        </div>
    );
}`;

const endIndex = content.lastIndexOf(endIndexStr) + endIndexStr.length - 14;

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find replace block', {startIndex, endIndex});
    process.exit(1);
}

const replacementJSX = `
            <Tabs defaultValue="welcome" className="space-y-6">
                <TabsList className="grid grid-cols-4 w-full md:w-[600px] bg-muted">
                    <TabsTrigger value="welcome">Welcome</TabsTrigger>
                    <TabsTrigger value="private">Private</TabsTrigger>
                    <TabsTrigger value="leave">Leave</TabsTrigger>
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                </TabsList>

                <TabsContent value="welcome" className="space-y-6">
                    <MessageConfigTab 
                        config={config} 
                        updateConfig={updateConfig} 
                        channels={channels} 
                        insertVariable={insertVariable} 
                        variableExamples={variableExamples} 
                        prefix="" 
                    />
                </TabsContent>
                
                <TabsContent value="private" className="space-y-6">
                    <MessageConfigTab 
                        config={config} 
                        updateConfig={updateConfig} 
                        channels={channels} 
                        insertVariable={insertVariable} 
                        variableExamples={variableExamples} 
                        prefix="private" 
                    />
                </TabsContent>
                
                <TabsContent value="leave" className="space-y-6">
                    <MessageConfigTab 
                        config={config} 
                        updateConfig={updateConfig} 
                        channels={channels} 
                        insertVariable={insertVariable} 
                        variableExamples={variableExamples} 
                        prefix="goodbye" 
                    />
                </TabsContent>
                
                <TabsContent value="roles" className="space-y-6">
                    <RolesTab 
                        autoRoleId={guildConfig.autoRoleId} 
                        setAutoRoleId={(val) => {
                            setGuildConfig({...guildConfig, autoRoleId: val});
                            setHasChanges(true);
                        }}
                        guildId={guildId} 
                    />
                </TabsContent>
            </Tabs>
`;

content = content.substring(0, startIndex) + replacementJSX + content.substring(endIndex);

fs.writeFileSync(pagePath, content);
console.log('page.tsx rewritten successfully');
