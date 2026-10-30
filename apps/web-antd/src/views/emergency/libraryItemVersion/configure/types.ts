export type CaseStep = 'basic' | 'clinical' | 'interview' | 'stages' | 'validation';
export type RuleType = 'main' | 'delay' | 'safety';
export type ConditionLogic = 'all' | 'any';
export type RuleTransition =
  | 'stayCurrentStage'
  | 'nextCycle'
  | 'nextStage'
  | 'instructorIntervention'
  | 'debriefExit';

export interface RuleCondition {
  id: string;
  field: string;
  operator: string;
  value: boolean | number | string;
}

export interface CaseRule {
  id: string;
  name: string;
  type: RuleType;
  conditionLogic: ConditionLogic;
  conditions: RuleCondition[];
  deadlineSeconds: number;
  effects: string[];
  scoreChange: number;
  transition: RuleTransition;
  oncePerCycle: boolean;
}

export type RuleDraft = Omit<CaseRule, 'id'>;