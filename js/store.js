export const store = {
    state: {
        niches: [],
        blocks: [],
        templates: [],
        accounts: [],
        placements: [],
        config: {},
        sync: {
            status: 'connecting',      // connecting | online | saving | error
            pendingWrites: 0,
            error: null,
            lastSyncAt: null
        }
    },
    _listeners: new Set(),
    subscribe(fn) {
        this._listeners.add(fn);
        fn(this.state);
        return () => this._listeners.delete(fn);
    },
    setState(partial) {
        Object.assign(this.state, partial);
        for (const fn of this._listeners) {
            try { fn(this.state); } catch (e) { console.error(e); }
        }
    }
};
