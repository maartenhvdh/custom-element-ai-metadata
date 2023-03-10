import $ from "jquery"
import { FC, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ManagementClient } from '@kontent-ai/management-sdk';
import { trackPromise } from 'react-promise-tracker';
import LoadingSpinner from './spinner/spinner';

export const ChatGTPMetadataApp: FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [metatadataTitle, setMetatadataTitle] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [itemName, setItemName] = useState<string | null>(null);
  const [codeName, setItemCodeName] = useState<string | null>(null);
  const [variantCodeName, setVariantCodeName] = useState<string | null>(null);
  const [watchedElementValue, setWatchedElementValue] = useState<string | null>(null);
  const [elementValue, setElementValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateWatchedElementValue = useCallback((codename: string) => {
    CustomElement.getElementValue(codename, v => typeof v === 'string' && setWatchedElementValue(v));
  }, []);

  const updateSize = useCallback(() => {
    const newSize = Math.max(document.documentElement.offsetHeight, 100);
    CustomElement.setHeight(Math.ceil(newSize));
  }, []);

  useLayoutEffect(() => {
    updateSize();
  }, [updateSize]);

  useEffect(() => {
    CustomElement.init((element, context) => {
      if (!isConfig(element.config)) {
        throw new Error('Invalid configuration of the custom element. Please check the documentation.');
      }

      setConfig(element.config);
      setProjectId(context.projectId);
      setIsDisabled(element.disabled);
      setItemName(context.item.name);
      setItemCodeName(context.item.codename);
      setVariantCodeName(context.variant.codename);
      setElementValue(element.value ?? '');
      updateWatchedElementValue(element.config.textElementCodename);
      updateSize()
    });
  }, [updateWatchedElementValue]);

  useEffect(() => {
    const newSize = Math.max(document.documentElement.offsetHeight, 50);
    CustomElement.setHeight(Math.ceil(newSize));
  }, []);

  useEffect(() => {
    CustomElement.onDisabledChanged(setIsDisabled);
  }, []);

  useEffect(() => {
    CustomElement.observeItemChanges(i => setItemName(i.name));
  }, []);

  useEffect(() => {
    if (!config) {
      return;
    }
    CustomElement.observeElementChanges([config.textElementCodename], () => updateWatchedElementValue(config.textElementCodename));
  }, [config, updateWatchedElementValue]);


  const saveContent = async (elenement: string, value: string) => {
    const client = new ManagementClient({
      projectId: projectId as any,
      apiKey: config?.managementApiKey as any
    });

    await client.upsertLanguageVariant()
      .byItemCodename(codeName as string)
      .byLanguageCodename(variantCodeName as string)
      .withData((builder) => [
        builder.textElement({
          element: {
            codename: elenement
          },
          value: value
        })
      ])
      .toPromise();
  }

  function processKeywords(keywords: string) {
		return keywords.replace("1.","").replace("2.",",").replace("3.",",").replace("4.",",").replace("5.",",").replace("/\n/g","");
	}	

  function generateAIMetadata() {
    $.post(config?.apiServiceUrl as any, { "type": "summary", "input": watchedElementValue })
      .done(function (data) {
        saveContent(config?.metadataDescription as any, JSON.parse(data).choices[0].text);
      });
    
      $.post(config?.apiServiceUrl as any, { "type": "keywords", "input": watchedElementValue })
      .done(function (data) {
        saveContent(config?.metadataKeywords as any, processKeywords(JSON.parse(data).choices[0].text));
      });
  }

  if (!config || !projectId || elementValue === null || watchedElementValue === null || itemName === null) {
    return null;
  }

  return (
    <>
      <section>
        {isLoading ? <LoadingSpinner /> : null}
        <span className="btn-wrapper">
          <button
            className="btn btn--primary"
            onClick={(e: any) => generateAIMetadata()}
          >
            Generate Metadata
          </button>
        </span>
      </section>
    </>
  );
};

ChatGTPMetadataApp.displayName = 'ChatSonicApp';

type Config = Readonly<{
  // expected custom element's configuration
  textElementCodename: string;
  metadataKeywords: string;
  metadataDescription: string;
  managementApiKey: string;
  apiServiceUrl: string;
}>;

// check it is the expected configuration
const isConfig = (v: unknown): v is Config =>
  isObject(v) &&
  hasProperty(nameOf<Config>('textElementCodename'), v) &&
  typeof v.textElementCodename === 'string' &&
  hasProperty(nameOf<Config>('metadataKeywords'), v) &&
  typeof v.metadataKeywords === 'string' &&
  hasProperty(nameOf<Config>('managementApiKey'), v) &&
  typeof v.managementApiKey === 'string' &&
  hasProperty(nameOf<Config>('metadataDescription'), v) &&
  typeof v.metadataDescription === 'string' &&
  hasProperty(nameOf<Config>('apiServiceUrl'), v) &&
  typeof v.apiServiceUrl === 'string';

const hasProperty = <PropName extends string, Input extends {}>(propName: PropName, v: Input): v is Input & { [key in PropName]: unknown } =>
  v.hasOwnProperty(propName);

const isObject = (v: unknown): v is {} =>
  typeof v === 'object' &&
  v !== null;

const nameOf = <Obj extends Readonly<Record<string, unknown>>>(prop: keyof Obj) => prop;
