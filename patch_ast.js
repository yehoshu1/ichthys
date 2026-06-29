const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

async function main() {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath('src/dashboard/app/dashboard/[guildId]/welcome/page.tsx');

    // Add imports
    sourceFile.addImportDeclaration({
        namedImports: ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'],
        moduleSpecifier: '@/components/ui/tabs'
    });
    sourceFile.addImportDeclaration({
        namedImports: ['MessageConfigTab'],
        moduleSpecifier: './components/MessageConfigTab'
    });
    sourceFile.addImportDeclaration({
        namedImports: ['RolesTab'],
        moduleSpecifier: './components/RolesTab'
    });

    const pageFunc = sourceFile.getFunction('WelcomePage');
    if (!pageFunc) throw new Error('WelcomePage function not found');

    // 1. Add guildConfig state
    pageFunc.insertStatements(1, 'const [guildConfig, setGuildConfig] = useState<any>({});');

    // 2. Modify fetchData
    const fetchDataFunc = pageFunc.getVariableDeclaration('fetchData').getInitializer().getStatements();
    // It's inside a useCallback.
    const tryBlock = fetchDataFunc.find(s => s.getKind() === SyntaxKind.TryStatement);
    const tryBody = tryBlock.getTryBlock();
    
    // Replace Promise.all
    const promiseAllStmt = tryBody.getStatements().find(s => s.getText().includes('Promise.all'));
    promiseAllStmt.replaceWithText(`const [configRes, channelsRes, guildRes] = await Promise.all([
        fetch(\`/api/guilds/\${guildId}/welcome/config\`),
        fetch(\`/api/guilds/\${guildId}/channels\`),
        fetch(\`/api/guilds/\${guildId}\`)
    ]);`);

    // Replace the if blocks for data processing
    const ifConfigRes = tryBody.getStatements().find(s => s.getText().includes('if (configRes.ok)'));
    ifConfigRes.replaceWithText(`if (configRes.ok) {
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

    // Remove the old if(channelsRes.ok) as we merged it
    const oldIfChannels = tryBody.getStatements().find(s => s.getText().includes('if (channelsRes.ok)') && s !== tryBody.getStatements().find(st => st.getText().includes('if (configRes.ok)')));
    if (oldIfChannels) oldIfChannels.remove();

    // 3. Modify saveConfig
    const saveConfigFunc = pageFunc.getVariableDeclaration('saveConfig').getInitializer().getStatements();
    const saveTryBlock = saveConfigFunc.find(s => s.getKind() === SyntaxKind.TryStatement);
    const saveTryBody = saveTryBlock.getTryBlock();
    
    const fetchSaveStmt = saveTryBody.getStatements().find(s => s.getText().includes('fetch(`/api/guilds/${guildId}/welcome/config`'));
    // Insert after fetchSaveStmt
    const fetchSaveIndex = fetchSaveStmt.getChildIndex();
    saveTryBody.insertStatements(fetchSaveIndex + 1, `
        await fetch(\`/api/guilds/\${guildId}\`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoRoleId: guildConfig.autoRoleId || null })
        });
    `);

    // 4. Modify insertVariable
    const insertVarFunc = pageFunc.getVariableDeclaration('insertVariable').getInitializer();
    insertVarFunc.replaceWithText(`useCallback((variable: string, key = 'messageTemplate') => {
        const template = (config as any)[key] || '';
        updateConfig(key as keyof WelcomeConfig, template + variable);
    }, [config, updateConfig])`);

    // 5. Replace JSX return block
    // We will do this via raw string replacement on the saved file, because ts-morph JSX replacement is tricky.
    
    await sourceFile.save();
    
    // Now do raw string replacement for the JSX part
    let content = fs.readFileSync(sourceFile.getFilePath(), 'utf8');
    
    const startIndex = content.indexOf('{/* Main Enable Toggle */}');
    const endIndexStr = `                            </CardContent>
                        </Card>
                    )}
        </div>
    );
}`;
    const endIndex = content.lastIndexOf(endIndexStr);
    
    if (startIndex !== -1 && endIndex !== -1) {
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
                        setAutoRoleId={(val: string) => {
                            setGuildConfig({...guildConfig, autoRoleId: val});
                            setHasChanges(true);
                        }}
                        guildId={guildId} 
                    />
                </TabsContent>
            </Tabs>
`;
        
        content = content.substring(0, startIndex) + replacementJSX + content.substring(endIndex + endIndexStr.length - 14);
        fs.writeFileSync(sourceFile.getFilePath(), content);
        console.log('Successfully patched JSX!');
    } else {
        console.log('Failed to find JSX bounds');
    }
}

main().catch(console.error);
