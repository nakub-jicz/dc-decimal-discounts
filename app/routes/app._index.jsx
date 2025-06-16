import { useEffect, useState, useCallback, useMemo } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
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
import { authenticate } from "../shopify.server";


const CHANGE_PERCENTAGE_MUTATION = `
  mutation change_percentage($id: ID!, $percentage: Float!) {
    discountCodeBasicUpdate(
      id: $id,
      basicCodeDiscount: { 
        customerGets: {
          value: {
            percentage: $percentage
          }
        }
      }
    ){
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            customerGets {
              value {
                ... on DiscountPercentage {
                  percentage
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;




export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  

  const response = await admin.graphql(
    `query MyQuery {
  discountNodes(first: 60) {
    nodes {
      discount {
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
          summary
          customerGets {
            value {
              ... on DiscountPercentage {
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

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const query = formData.get("query");
  const variables = JSON.parse(formData.get("variables"));

  const response = await admin.graphql(query, { variables });
  const responseJson = await response.json();
  return responseJson;
};

export default function Index() {
  
  const shopify = useAppBridge();
  
  const mapa_znizek = new Map()
  const deselectedOptions = []
  const discounts = useLoaderData()
  console.log(discounts)
  const nody = discounts.data.discountNodes.nodes
  nody.forEach(n => {
    if (Object.keys(n.discount).length > 0) {
      if (Object.keys(n.discount.customerGets.value).length > 0) {
        deselectedOptions.push({ label: n.discount.title, value: n.id })
        mapa_znizek.set(n.id, n.discount.customerGets.value.percentage)
        console.log(n)
      }
    }
  });
  
  const [options, setOptions] = useState(deselectedOptions);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedDiscountID, setSelectedDiscountID] = useState("")
  const fetcher = useFetcher();
  const [currentPercentage, setCurrentPercentage] = useState(0.00)
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");
  const [toastError, setToastError] = useState(false);
  const [previewURL, setPreviewURL] = useState("")
  const [pierwotnyPrecentaz, setPierwotnyPrecentaz] = useState(0.00)
  
  const updateText = useCallback(
    (value) => {
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
    (selected) => {
      const selectedValue = selected.map((selectedItem) => {
        const matchedOption = options.find((option) => {
          return option.value.match(selectedItem);
        });
        return matchedOption && matchedOption.label;
      });

      setSelectedOptions(selected);
      setInputValue(selectedValue[0] || '');
      setSelectedDiscountID(selected[0])
      setCurrentPercentage((mapa_znizek.get(selected[0]) * 100).toFixed(2))
      setPierwotnyPrecentaz((mapa_znizek.get(selected[0]) * 100).toFixed(2))
      console.log("PIERWOTNY: "+pierwotnyPrecentaz)
    },
    [options],
  );

  useEffect(() => {
    if (fetcher.data && fetcher.data.data && fetcher.data.data.discountCodeBasicUpdate) {
      const { userErrors, codeDiscountNode } = fetcher.data.data.discountCodeBasicUpdate;
      if (userErrors && userErrors.length > 0) {
        setToastContent(userErrors[0].message);
        setToastError(true);
        setToastActive(true);
      } else if (codeDiscountNode) {
        setToastContent("Discount updated successfully!");
        setToastError(false);
        setToastActive(true);
      }
    }
  }, [fetcher.data]);

  const handleSave = () => {
    ApplyDiscount()
    console.log('Saving');
    shopify.saveBar.hide('my-save-bar');
  };

  const handleDiscard = () => {
    console.log(pierwotnyPrecentaz);
    setCurrentPercentage(pierwotnyPrecentaz)
    shopify.saveBar.hide('my-save-bar');
  };

  const ApplyDiscount = () => {
    if (!selectedDiscountID || currentPercentage < 0 || currentPercentage > 100) {
      setToastContent("Please select a discount and enter a valid percentage (0-100).");
      setToastError(true);
      setToastActive(true);
      return;
    }
    const nowy_procent = (currentPercentage / 100).toFixed(4);
    fetcher.submit(
      {
        query: CHANGE_PERCENTAGE_MUTATION,
        variables: JSON.stringify({
          id: selectedDiscountID,
          percentage: parseFloat(nowy_procent)
        })
      },
      { method: "post" }
    );
    console.log("NOWY PROCENT" + (nowy_procent*100).toFixed(2))
    setPierwotnyPrecentaz((nowy_procent*100).toFixed(2))
  };

  return (
    <Page>
      <TitleBar title="DC Decimal Discounts">
      </TitleBar>
      <SaveBar id="my-save-bar">
        <button variant="primary" onClick={handleSave}></button>
        <button onClick={handleDiscard}></button>
      </SaveBar>
      <BlockStack gap="500">
        <Frame>
          <Card >
            <FormLayout>
            <Autocomplete
              options={options}
              selected={selectedOptions}
              onSelect={updateSelection}
              textField={textField}
            />
              <TextField
                label="Percentage"
                type="number"
                value={currentPercentage}
                onChange={(val) => {
                  setCurrentPercentage(val)
                  if(currentPercentage != pierwotnyPrecentaz) {
                    shopify.saveBar.show('my-save-bar')
                  } else {
                    shopify.saveBar.hide('my-save-bar')
                  }
                }}
                suffix="%"
                autoComplete="off"
                autoSize
                size="slim"
                min={0}
                max={100}
                id="wejscie_procentaza"
              />
              <Button
                variant="primary"
                onClick={ApplyDiscount}
                icon={CheckIcon}
                loading={fetcher.state === "submitting"}
                disabled={fetcher.state === "submitting"}
              >
                Apply discount</Button>


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
    </Page>
  );
}
