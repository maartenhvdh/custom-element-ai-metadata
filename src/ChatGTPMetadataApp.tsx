import { FC, useCallback, useEffect, useState } from 'react';
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

  const updateValue = (newValue: string) => {
    CustomElement.setValue(newValue);
    setElementValue(newValue);
  };

  const saveContent = async (val: any) => {
    setMetatadataTitle(val)
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
            codename: 'metadata_summary'
          },
          value: val.message
        })
      ])
      .toPromise();
  }

  async function generateAIContent() {
    setIsLoading(true);
    const options = {
      method: 'POST',
      body: JSON.stringify({
        type: 'summary',
        input: watchedElementValue
      })
    };
    trackPromise(
      fetch('https://kontentapp.azurewebsites.net/elements/openai/', options)
        .then(response => {
          console.log(response)
          saveContent(response)
          setIsLoading(false)
        })
        .catch(err => {
          setIsLoading(false);
          console.error(err)
        })
    );
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
            onClick={(e: any) => generateAIContent()}
          >
           Generate Metadata
          </button>
        </span>
        <table>
          <tr>
            <th>Summary:</th>
            <th id="summary">{metatadataTitle}</th>
          </tr>
          <tr>
            <td>Keywords:</td>
            <td id="keywords"></td>
          </tr>
          <tr>
            <td>Thumbnail</td>
            <td id="thumbnail"></td>
          </tr>
        </table>
      </section>
    </>
  );
};

ChatGTPMetadataApp.displayName = 'ChatSonicApp';

type Config = Readonly<{
  // expected custom element's configuration
  textElementCodename: string;
  metadataTitle: string;
  metadataDescription: string;
  managementApiKey: string;
}>;

// check it is the expected configuration
const isConfig = (v: unknown): v is Config =>
  isObject(v) &&
  hasProperty(nameOf<Config>('textElementCodename'), v) &&
  typeof v.textElementCodename === 'string' &&
  hasProperty(nameOf<Config>('metadataTitle'), v) &&
  typeof v.metadataTitle === 'string' &&
  hasProperty(nameOf<Config>('managementApiKey'), v) &&
  typeof v.managementApiKey === 'string' &&
  hasProperty(nameOf<Config>('metadataDescription'), v) &&
  typeof v.metadataDescription === 'string';

const hasProperty = <PropName extends string, Input extends {}>(propName: PropName, v: Input): v is Input & { [key in PropName]: unknown } =>
  v.hasOwnProperty(propName);

const isObject = (v: unknown): v is {} =>
  typeof v === 'object' &&
  v !== null;

const nameOf = <Obj extends Readonly<Record<string, unknown>>>(prop: keyof Obj) => prop;
