import { useEffect, useState, useCallback, useMemo } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Select,
  Autocomplete,
  Icon,
  TextField,
  Toast,
  Banner,
  Frame,
  InlineGrid,
  FormLayout,
} from "@shopify/polaris";
import {
  SearchIcon,
  CheckIcon,
  ViewIcon
} from "@shopify/polaris-icons"
import { TitleBar, useAppBridge, SaveBar } from "@shopify/app-bridge-react";
import { shopify } from "../shopify.server";
import { json } from "@remix-run/node";

type SuccessResponse = { success: boolean; error?: string };

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const { admin } = await shopify(context).authenticate.admin(request);

  const response = await admin.graphql(
    `query MyQuery {
      discountNodes(first: 60) {
        nodes {
          discount {
            __typename
            ... on DiscountCodeBasic {
              summary
              title
              customerGets {
                value {
                  ... on DiscountPercentage {
                    __typename
                    percentage
                  }
                }
              }
            }
            ... on DiscountAutomaticBxgy {
              __typename
              title
              summary
              customerGets {
                value {
                  ... on DiscountPercentage {
                    __typename
                    percentage
                  }
                }
              }
            }
            ... on DiscountAutomaticBasic {
              __typename
              customerGets {
                value {
                  ... on DiscountPercentage {
                    __typename
                    percentage
                  }
                }
              }
              title
              summary
            }
            ... on DiscountCodeBxgy {
              __typename
              summary
              customerGets {
                value {
                  ... on DiscountPercentage {
                    __typename
                    percentage
                  }
                }
              }
              title
            }
          }
          id
        }
      }
    }`
  )
  const responseJson = await response.json()

  return responseJson;
};

// Osobne mutacje dla każdego typu zniżki
const MUTATION_BASIC = `
  mutation UpdateBasicDiscount($id: ID!, $percentage: Float!) {
    discountCodeBasicUpdate(
      id: $id
      basicCodeDiscount: {customerGets: {value: {percentage: $percentage}}}
    ) {
      userErrors { message }
      codeDiscountNode { id }
    }
  }
`;
const MUTATION_BXGY = `
  mutation UpdateBxgyDiscount($id: ID!, $percentage: Float!) {
    discountCodeBxgyUpdate(
      id: $id
      bxgyCodeDiscount: {customerGets: {value: {percentage: $percentage}}}
    ) {
      userErrors { message }
      codeDiscountNode { id }
    }
  }
`;
const MUTATION_AUTOMATIC_BASIC = `
  mutation UpdateAutomaticBasicDiscount($id: ID!, $percentage: Float!) {
    discountAutomaticBasicUpdate(
      id: $id
      automaticBasicDiscount: {customerGets: {value: {percentage: $percentage}}}
    ) {
      userErrors { message }
      automaticDiscountNode { id }
    }
  }
`;
const MUTATION_AUTOMATIC_BXGY = `
  mutation UpdateAutomaticBxgyDiscount($id: ID!, $percentage: Float!) {
    discountAutomaticBxgyUpdate(
      id: $id
      automaticBxgyDiscount: {customerGets: {value: {percentage: $percentage}}}
    ) {
      userErrors { message }
      automaticDiscountNode { id }
    }
  }
`;

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { admin } = await shopify(context).authenticate.admin(request);
  const formData = await request.formData();
  const id = formData.get("id");
  const percentage = formData.get("percentage");
  const discountType = formData.get("discountType");

  console.log("[ACTION] otrzymano:", { id, percentage, discountType });

  if (!id || !percentage || !discountType) {
    console.log("[ACTION] Brak wymaganych danych");
    return json({ success: false, error: "Brak wymaganych danych." });
  }

  const rawPercentage = (percentage as string).replace(',', '.');
  const variables = { id, percentage: parseFloat(rawPercentage) / 100 };
  let mutation;
  let resultKey;
  switch (discountType) {
    case "basic":
      mutation = MUTATION_BASIC;
      resultKey = "discountCodeBasicUpdate";
      break;
    case "bxgy":
      mutation = MUTATION_BXGY;
      resultKey = "discountCodeBxgyUpdate";
      break;
    case "automaticBasic":
      mutation = MUTATION_AUTOMATIC_BASIC;
      resultKey = "discountAutomaticBasicUpdate";
      break;
    case "automaticBxgy":
      mutation = MUTATION_AUTOMATIC_BXGY;
      resultKey = "discountAutomaticBxgyUpdate";
      break;
    default:
      console.log("[ACTION] Nieznany typ zniżki:", discountType);
      return json({ success: false, error: "Nieznany typ zniżki." });
  }

  console.log("[ACTION] Wybrana mutacja:", resultKey, "Zmienne:", variables);
  const response = await admin.graphql(mutation, { variables });
  const data = await response.json();
  console.log("[ACTION] Odpowiedź z Shopify:", data);
  const mutationResult = data?.data?.[resultKey];
  const userErrors = mutationResult?.userErrors;
  if (userErrors && userErrors.length > 0) {
    console.log("[ACTION] Błąd userErrors:", userErrors);
    return json({ success: false, error: userErrors[0].message });
  }

  console.log("[ACTION] Sukces!");
  return json({ success: true });
};

type DiscountNode = {
  discount: {
    title: string;
    customerGets: {
      value: {
        percentage: number;
      };
    };
  };
  id: string;
};

type LoaderData = {
  data: {
    discountNodes: {
      nodes: DiscountNode[];
    };
  };
};

// Dodaj funkcję pomocniczą do formatowania
function formatPercentageString(val: string | number): string {
  let num = typeof val === 'number' ? val : parseFloat(val.replace(',', '.'));
  if (isNaN(num)) return '';
  return num.toFixed(2).replace('.', ',');
}

export default function Index() {
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const actionData = useActionData<SuccessResponse>();
  const discounts = useLoaderData() as LoaderData;

  const mapa_znizek = useMemo(() => new Map<string, number>(), []);
  const deselectedOptions: { label: string; value: string }[] = [];
  const nody = discounts.data.discountNodes.nodes;
  nody.forEach(n => {
    if (
      n.discount &&
      n.discount.customerGets &&
      n.discount.customerGets.value &&
      typeof n.discount.customerGets.value.percentage === "number"
    ) {
      deselectedOptions.push({ label: n.discount.title, value: n.id })
      mapa_znizek.set(n.id, n.discount.customerGets.value.percentage)
    }
  });

  const [options, setOptions] = useState(deselectedOptions);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedDiscountID, setSelectedDiscountID] = useState<string>("")
  const [currentPercentage, setCurrentPercentage] = useState<number | string>(0.00)
  const [pierwotnyPrecentaz, setPierwotnyPrecentaz] = useState<number | string>(0.00)
  const [saveBarVisible, setSaveBarVisible] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");
  const [toastError, setToastError] = useState(false);

  // Mapowanie ID zniżki na typ
  const discountIdToType = useMemo(() => {
    const map = new Map<string, string>();
    nody.forEach((n: DiscountNode) => {
      if ((n as any).discount && (n as any).discount.__typename) {
        switch ((n as any).discount.__typename) {
          case "DiscountCodeBasic":
            map.set(n.id, "basic");
            break;
          case "DiscountCodeBxgy":
            map.set(n.id, "bxgy");
            break;
          case "DiscountAutomaticBasic":
            map.set(n.id, "automaticBasic");
            break;
          case "DiscountAutomaticBxgy":
            map.set(n.id, "automaticBxgy");
            break;
          default:
            break;
        }
      }
    });
    return map;
  }, [nody]);

  function getDiscountTypeForSelected(id: string): string {
    return discountIdToType.get(id) || "basic";
  }

  const updateText = useCallback(
    (value: string) => {
      setInputValue(value);

      if (value === '') {
        setOptions(deselectedOptions);
        return;
      }

      const filterRegex = new RegExp(value, 'i');
      const resultOptions = deselectedOptions.filter((option) =>
        option.label.match(filterRegex),
      );
      setOptions(resultOptions);
    },
    [deselectedOptions],
  );

  const textField = (
    <Autocomplete.TextField
      onChange={updateText}
      label="Select percentage discount"
      value={inputValue}
      prefix={<Icon source={SearchIcon} tone="base" />}
      placeholder="Search"
      autoComplete="off"
    />
  );

  const updateSelection = useCallback(
    (selected: string[]) => {
      const selectedValue = selected.map((selectedItem) => {
        const matchedOption = options.find((option) => {
          return option.value.match(selectedItem);
        });
        return matchedOption && matchedOption.label;
      });

      setSelectedOptions(selected);
      setInputValue(selectedValue[0] || '');
      setSelectedDiscountID(selected[0])
      const percent = mapa_znizek.get(selected[0]);
      if (typeof percent === "number") {
        const percentValue = formatPercentageString(percent * 100);
        setCurrentPercentage(percentValue)
        setPierwotnyPrecentaz(percentValue)
      }
    },
    [options, mapa_znizek],
  );

  // SaveBar obsługa
  useEffect(() => {
    if (currentPercentage !== pierwotnyPrecentaz) {
      shopify.saveBar.show('my-save-bar');
    } else {
      shopify.saveBar.hide('my-save-bar');
    }
  }, [currentPercentage, pierwotnyPrecentaz, shopify]);

  useEffect(() => {
    console.log('[useEffect] actionData:', actionData);
    if (actionData?.success) {
      shopify.saveBar.hide('my-save-bar');
      setPierwotnyPrecentaz(currentPercentage);
      setToastContent("Discount updated successfully!");
      setToastError(false);
      setToastActive(true);
    } else if (actionData && actionData.error) {
      setToastContent(actionData.error || "Unknown error");
      setToastError(true);
      setToastActive(true);
    }
  }, [actionData, shopify, currentPercentage]);

  useEffect(() => {
    console.log('DEBUG selectedDiscountID:', selectedDiscountID);
    console.log('DEBUG discountType:', getDiscountTypeForSelected(selectedDiscountID));
  }, [selectedDiscountID]);

  // Obsługa SaveBar (zapisz/odrzuć)
  const handleSave = () => {
    // submituje formularz przez JS (możesz też wywołać submit na ref Form, jeśli chcesz)
    document.getElementById("discount-form")?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };
  const handleDiscard = () => {
    setCurrentPercentage(pierwotnyPrecentaz);
    setSaveBarVisible(false);
  };

  return (
    <Page>
      <TitleBar title="DC Decimal Discounts" />
      <SaveBar id="my-save-bar" />
      <div style={{ marginBottom: 16, color: 'red' }}>
        <div>selectedDiscountID: {selectedDiscountID || '(pusty)'}</div>
        <div>discountType: {getDiscountTypeForSelected(selectedDiscountID) || '(pusty)'}</div>
      </div>
      <Form method="post" id="discount-form">
        <BlockStack gap="500">
          <Frame>
            <Card>
              <FormLayout>
                <Autocomplete
                  options={options}
                  selected={selectedOptions}
                  onSelect={updateSelection}
                  textField={textField}
                />
                <TextField
                  label="Percentage"
                  type="text"
                  value={String(currentPercentage)}
                  name="percentage"
                  onChange={(val) => {
                    let sanitized = val.replace(/[^0-9.,]/g, '');
                    sanitized = sanitized.replace('.', ',');
                    setCurrentPercentage(sanitized);
                  }}
                  onBlur={() => {
                    setCurrentPercentage(formatPercentageString(currentPercentage));
                  }}
                  suffix="%"
                  autoComplete="off"
                  autoSize
                  size="slim"
                  min={0}
                  max={100}
                  id="wejscie_procentaza"
                />
                <input type="hidden" name="id" value={selectedDiscountID || 'debug-id'} />
                <input type="hidden" name="discountType" value={getDiscountTypeForSelected(selectedDiscountID) || 'basic'} />
                <Button
                  variant="primary"
                  icon={CheckIcon}
                  submit
                  loading={navigation.state === "submitting" || navigation.state === "loading"}
                  onClick={() => { console.log('[Button] Apply Discount clicked') }}
                >
                  Apply discount
                </Button>
                <button type="submit" style={{ display: 'block', marginTop: 8 }}>Natywny submit</button>
              </FormLayout>
            </Card>
            {toastActive && (
              <Toast
                content={toastContent}
                error={toastError}
                onDismiss={() => setToastActive(false)}
              />
            )}
          </Frame>
        </BlockStack>
      </Form>
    </Page>
  );
}
