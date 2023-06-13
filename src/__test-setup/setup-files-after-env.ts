afterEach(async () => {
    await Promise.all([global.keyValueStorage!.clearAll(), global.keyOnlyStorage?.clearAll()]);
});
