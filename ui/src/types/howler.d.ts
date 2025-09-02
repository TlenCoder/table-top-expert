declare module 'howler' {
  export interface HowlOptions {
    src: string[];
    volume?: number;
    loop?: boolean;
    rate?: number;
  }
  export class Howl {
    constructor(options: HowlOptions);
    play(id?: number): number;
    stop(id?: number): void;
    pause(id?: number): void;
    volume(vol?: number): number;
  }
}

