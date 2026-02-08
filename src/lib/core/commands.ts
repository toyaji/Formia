import { Operation } from 'rfc6902';
import { FormFactor } from './schema';

export interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
  metadata: {
    type: string;
    description: string;
    timestamp: string;
  };
}

export class PatchCommand implements Command {
  constructor(
    private store: {
      formFactor: FormFactor | null;
      applyJsonPatch: (patches: Operation[]) => void;
      setFormFactor: (factor: FormFactor) => void;
    },
    private patches: Operation[],
    private inversePatches: Operation[],
    public metadata: {
      type: string;
      description: string;
      timestamp: string;
    }
  ) {}

  execute() {
    this.store.applyJsonPatch(this.patches);
  }

  undo() {
    // For simplicity with RFC6902, we can swap between state snapshots 
    // or use inverse patches if available. 
    // Here we assume execute already happened.
    this.store.applyJsonPatch(this.inversePatches);
  }

  redo() {
    this.execute();
  }
}
