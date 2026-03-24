/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// eslint-disable-next-line import/prefer-default-export
export const loadComponents = async (config) => {
  const components = { models: {}, definition: {}, filters: {} };
  if (config.origin) {
    const fetchOptional = async (path) => {
      const res = await fetch(`${config.origin}/${path}`);
      if (!res.ok) {
        if (res.status === 404) {
          // eslint-disable-next-line no-console
          console.warn(`Importer: ${path} not found (404). JCR packaging may require it. Using empty config.`);
          return null;
        }
        throw new Error(`Failed to fetch ${path}: ${res.status}`);
      }
      return res.text();
    };

    const [componentModels, componentsDefinition, componentFilters] = await Promise.all([
      fetchOptional('component-models.json'),
      fetchOptional('component-definition.json'),
      fetchOptional('component-filters.json'),
    ]);

    if (componentModels) components.models = JSON.parse(componentModels);
    if (componentsDefinition) components.definition = JSON.parse(componentsDefinition);
    if (componentFilters) components.filters = JSON.parse(componentFilters);
  }
  return components;
};
