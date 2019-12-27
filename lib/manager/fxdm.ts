"use strict";

import { runtime, Downloads, DownloadOptions, DownloadsQuery, ExtensionListener, RawPort } from '../browser';
import { EventEmitter } from '../events';

//License: MIT

class Deferred<T> {
    public resolve: Function;
    public reject: Function;
    public promise: Promise<T>;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

class EventAdaptor implements ExtensionListener {
    private event: string;
    private emitter: EventEmitter;

    constructor(emitter: EventEmitter, event: string) {
        this.emitter = emitter;
        this.event = event;
    }

    public addListener(listener: Function) {
        // @ts-ignore
        this.emitter.on(this.event, listener);
    }
    
    public removeListener(listener: Function) {
        // @ts-ignore
        this.emitter.off(this.event, listener);
    }
}

export class Fxdm implements Downloads {
    public onCreated: ExtensionListener;
    public onChanged: ExtensionListener;
    public onErased: ExtensionListener;
    public onDeterminingFilename?: ExtensionListener | undefined;
    private fxPort: RawPort | undefined;
    private reqId: number;
    private inflight : Map<number, Deferred<any>>;
    private events : EventEmitter;

    constructor() {
        this.inflight = new Map<number, Deferred<any>>();
        this.reqId = 0;
        this.events = new EventEmitter();
        this.onCreated = new EventAdaptor(this.events, 'created');
        this.onChanged = new EventAdaptor(this.events, 'changed');
        this.onErased = new EventAdaptor(this.events, 'erased');
        this.setupFxPort();
    }

    private setupFxPort() {
        console.log('connecting to fxdm');
        this.fxPort = runtime.connectNative('fxdm');
        this.fxPort!.onDisconnect.addListener(() => {
            console.log('disconnected from fxdm');
            if (this.fxPort!.error) {
                console.log('fxdm port disconnected with error', this.fxPort!.error);
            }
            for (const v of this.inflight.values()) {
                v.reject(new Error('disconnected'));
            }
            this.fxPort = undefined;
            this.inflight.clear();
            setTimeout(() => this.setupFxPort(), 1000);
        });

        this.fxPort!.onMessage.addListener((resp: any) => {
            console.log('received message', resp);
            const {msg, req, data} = resp;

            if (req !== undefined) {
                const promise = this.inflight.get(req);
                this.inflight.delete(req);

                if (promise) {
                    promise.resolve(data);
                }
            }
            console.log(msg, data);
        });
    }

    private getFx(): Promise<RawPort> {
        return Promise.resolve(this.fxPort!);
    }

    private async postMessage<T>(msg: string, data: any) : Promise<T> {
        const fx = await this.getFx();
        const req = this.reqId++;
        const deferred = new Deferred<T>();
        this.inflight.set(req, deferred);
        fx.postMessage({msg, req, data})
        return deferred.promise;
    }

    public download(download: DownloadOptions): Promise<number> {
        return this.postMessage<number>('download', download);
    }

    public open(manId: number): Promise<void> {
        return this.postMessage<void>('open', {id: manId});
    }

    public show(manId: number): Promise<void> {
        return this.postMessage<void>('show', {id: manId});
    }

    public pause(manId: number): Promise<void> {
        return this.postMessage<void>('pause', {id: manId});
    }

    public resume(manId: number): Promise<void> {
        return this.postMessage<void>('resume', {id: manId});
    }

    public cancel(manId: number): Promise<void> {
        return this.postMessage<void>('cancel', {id: manId});
    }

    public erase(query: DownloadsQuery): Promise<void> {
        if (query.id === undefined) {
            return Promise.resolve();
        }
        return this.postMessage<void>('erase', {id: query.id});
    }

    public search(query: DownloadsQuery): Promise<any[]> {
        if (query.id === undefined) {
            return Promise.resolve([]);
        }
        return this.postMessage<any[]>('search', {id: query.id});
    }

    public getFileIcon(id: number, options?: any): Promise<string> {
        return Promise.resolve('');
    }

    public setShelfEnabled(state: boolean): void {
    }

    public removeFile(manId: number): Promise<void> {
        return this.postMessage<void>('removeFile', {id: manId});
    }
}
