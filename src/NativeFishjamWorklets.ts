import { type TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  install(): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('FishjamWorklets');
