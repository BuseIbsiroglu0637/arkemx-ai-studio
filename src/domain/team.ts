export type Department =
  | 'Yönetim'
  | 'Geliştirme'
  | 'Tasarım'
  | 'Kalite'
  | 'Araştırma';

export const DEPARTMENTS: Department[] = [
  'Yönetim',
  'Geliştirme',
  'Tasarım',
  'Kalite',
  'Araştırma',
];

export type Experience = {
  id: string;
  title: string;
  project: string;
  date: string;
  evidenceUrl: string;
  verification: 'pending' | 'verified';
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  department: Department;
  description: string;
  skills: string[];
  responsibilities: string[];
  workingStyle: string;
  color: string;
  avatarKey: string;
  status: 'ready' | 'paused';
  project: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  modelStatus: 'disconnected';
  experience: Experience[];
};

export type TeamMemberInput = Pick<
  TeamMember,
  | 'name'
  | 'role'
  | 'department'
  | 'description'
  | 'skills'
  | 'responsibilities'
  | 'workingStyle'
  | 'color'
  | 'avatarKey'
  | 'project'
>;
